---
title: "Data Architecture"
---


# Acme Telco — Data Architecture

## Introduction

Acme Telco's data architecture spans multiple database technologies, each chosen for the specific performance and operational requirements of the systems they support. The data landscape processes approximately 500 million CDR records daily, ingests 10,000 network metrics per second, and maintains subscriber records for 4 million customers.

Understanding the data architecture is critical for cross-system integration, capacity planning, reporting, and the ongoing migration of analytics workloads to the Acme Corp centralized Snowflake data platform. For system context, see [System Landscape](../technical/system-landscape.md). For CDR processing details, see [Billing Mediation](../technical/billing-mediation.md). For the architectural overview, see [Architecture Overview](../architecture/overview.md).

## Database Landscape

| Database | Technology | Version | System(s) | Purpose | Deployment |
|----------|-----------|---------|-----------|---------|------------|
| Billing/Mediation DB | Oracle | 19c (19.21) | Billing Mediation | CDR storage, billing aggregation, invoice data | Azure VM |
| Rating Catalog DB | PostgreSQL | 15.x | Rating & Charging Engine | Rate plan catalog, rating history, audit trail | Azure Database for PostgreSQL |
| Rating Cache | Redis | 7.x | Rating & Charging Engine | Subscriber balances, session state, bundle counters | Azure Cache for Redis |
| CRM Local Cache | PostgreSQL | 15.x | CRM Integration Layer | Salesforce data cache, enrichment data | Azure Database for PostgreSQL |
| Portal DB | PostgreSQL | 15.x | Self-Service Portal | Session management, portal config, user preferences | Azure Database for PostgreSQL |
| Provisioning DB | PostgreSQL | 15.x | Service Provisioning | SIM inventory, provisioning workflow state, audit log | On-premises PostgreSQL |
| Fault DB | PostgreSQL | 14.x | Fault Management | Alarm data, correlation rules, fault history | On-premises PostgreSQL (needs upgrade to 15) |
| Metrics DB | TimescaleDB | 2.x (on PG 15) | Network Monitoring | Network metrics time-series, capacity planning data | On-premises TimescaleDB |

### Database Details

**Oracle 19c (Billing/Mediation):** The largest database by volume. Stores all CDR data through the billing lifecycle. Current size: ~45 TB online (90-day CDR retention + 5-year invoice archive). Growth rate: ~2 TB/day raw CDR ingestion. Backup: RMAN incremental backups every 4 hours, full backup weekly. RPO: 4 hours, RTO: 2 hours. HA: Oracle Data Guard with synchronous standby. Access pattern: OLTP (CDR ingestion) + OLAP (reconciliation queries, billing aggregation).

**PostgreSQL 15.x (multiple instances):** Standard relational database for BSS and OSS systems. Individual instance sizes range from 50 GB (Portal DB) to 500 GB (Rating Catalog with history). Backup: pg_basebackup daily + WAL archiving for PITR. RPO: 5 minutes, RTO: 1 hour. HA: Azure Database for PostgreSQL with zone-redundant HA (BSS); streaming replication (OSS on-premises).

**Redis 7 (Rating Cache):** In-memory data store for subscriber balances. Size: ~12 GB across 6-node cluster. No growth expected unless subscriber base increases significantly. Persistence: RDB snapshots every 5 minutes + AOF. RPO: ~1 second (AOF), RTO: < 5 minutes (failover to replica). Eviction: disabled (all data must be resident).

**TimescaleDB 2.x (Metrics):** Time-series database for network monitoring data. Current size: ~2 TB (90 days raw + 2 years aggregated). Growth rate: ~20% YoY driven by 5G expansion. Backup: pg_basebackup daily. RPO: 1 hour, RTO: 4 hours. Compression: 10:1 ratio on chunks older than 7 days.

**PostgreSQL 14.x (Fault DB):** Slated for upgrade to 15.x as part of the Fault Management Java 17 migration. Current size: ~200 GB. Separate backup schedule from the PostgreSQL 15 instances due to version differences.

## CDR Data Flow

```
Network Elements
  |  Raw CDRs (ASN.1 binary, vendor-specific formats)
  |  Volume: ~500M records/day, ~2TB/day raw
  v
Billing Mediation (Oracle 19c)
  |  Stages: Collect -> Validate -> Normalize -> Enrich
  |  Tables: CDR_RAW -> CDR_VALIDATED -> CDR_ENRICHED
  |  Reject rate: ~0.05% (-> CDR_REJECT table)
  |  Output: Enriched CDRs in internal schema
  v
Rating Engine (Redis + PostgreSQL 15)
  |  Online: Prepaid balance check + debit (Redis)
  |  Offline: Rate plan application + charge calculation
  |  Output: Rated CDRs with charge amounts
  v
Billing Aggregation (Oracle 19c)
  |  Tables: CDR_RATED -> INVOICE_LINE_ITEMS
  |  Monthly aggregation by subscriber + charge category
  |  Tax calculation applied
  v
Invoice Generation (Oracle 19c)
  |  Tables: INVOICES, INVOICE_LINE_ITEMS, PAYMENTS
  |  Output: Subscriber invoices (PDF + structured data)
  v
Payment Processing
  |  3rd-party processor (PCI-DSS scope reduction)
  |  Payment confirmation -> PAYMENTS table
  v
Data Warehouse (Snowflake - via Acme Tech data platform)
  |  Nightly ETL: CDR_RATED, INVOICES, PAYMENTS, subscriber data
  |  Cross-subsidiary analytics and group reporting
```

Each stage of the pipeline has reconciliation checkpoints. Count and value reconciliation runs daily to detect any data loss or processing anomalies between stages.

## Data Volumes

| Data Category | Daily Volume | Monthly Volume | Annual Growth |
|---------------|-------------|----------------|---------------|
| CDR records (all types) | ~500M records | ~15B records | ~10% YoY |
| CDR storage (raw) | ~2 TB | ~60 TB | ~10% YoY |
| CDR storage (rated) | ~500 GB | ~15 TB | ~10% YoY |
| Network metrics | 10K metrics/sec (~864M/day) | ~26B data points | ~20% YoY (5G growth) |
| Subscriber records | ~4M total | — | ~3% net growth |
| Invoices | ~3.5M/month | ~42M/year | ~3% growth |

CDR volume growth is primarily driven by increasing data session frequency (more devices, more streaming, IoT expansion). 5G deployment is expected to accelerate data CDR growth as network capacity enables higher-bandwidth applications. Network metrics growth is driven by the expansion of gNMI streaming telemetry (10-second intervals vs. 60-second SNMP polling) and the addition of new 5G cell sites.

## Oracle Schema Overview (Billing Mediation)

### CDR_RAW

- **Purpose:** Raw CDR records as received from network elements
- **Partitioning:** Range partitioned by `collection_date` (daily partitions)
- **Retention:** 90 days online, archived to cold storage thereafter
- **Key Columns:** `cdr_id` (PK), `source_element`, `collection_timestamp`, `raw_payload` (BLOB), `format_type`, `processing_status`
- **Indexes:** Composite index on `(collection_date, source_element, processing_status)` for batch job queries

### CDR_RATED

- **Purpose:** CDRs after rating with charge amounts applied
- **Partitioning:** Range partitioned by `rating_date` (daily partitions)
- **Retention:** 180 days online, archived to cold storage thereafter
- **Key Columns:** `cdr_id` (PK), `subscriber_id`, `event_type`, `duration_seconds`, `bytes_transferred`, `charge_amount`, `rate_plan_id`, `promotion_ids` (array), `tax_amount`
- **Indexes:** Composite on `(subscriber_id, rating_date)` for invoice generation; composite on `(rate_plan_id, rating_date)` for revenue analysis

### INVOICES

- **Purpose:** Monthly subscriber invoices
- **Retention:** 5 years online (regulatory requirement for billing dispute resolution)
- **Key Columns:** `invoice_id` (PK), `subscriber_id`, `billing_period_start`, `billing_period_end`, `total_amount`, `tax_amount`, `payment_due_date`, `status` (generated, delivered, paid, overdue, disputed)

### PAYMENTS

- **Purpose:** Payment records linked to invoices
- **Key Columns:** `payment_id` (PK), `invoice_id` (FK), `subscriber_id`, `amount`, `payment_method` (credit_card, ach, apple_pay, google_pay, in_store), `processor_reference`, `payment_timestamp`, `status`
- **Note:** No card data stored — `processor_reference` is a tokenized reference to the third-party payment processor's transaction record (PCI-DSS scope reduction)

### RATE_PLANS

- **Purpose:** Versioned rate plan definitions
- **Key Columns:** `plan_id` (PK), `plan_name`, `plan_type` (prepaid, postpaid, family, business), `effective_date`, `end_date`, `base_charge`, `data_allowance_mb`, `voice_allowance_min`, `sms_allowance`
- **Versioning:** New plan version created for any rate change. Old versions retained indefinitely for historical rating accuracy (allows re-rating of disputed charges against the plan that was active at time of usage).

Note: This overview covers the most frequently referenced tables. The full Oracle DDL (200+ tables) is maintained in the database team's repository.

## TimescaleDB Hypertable Design

### network_metrics Hypertable

- **Chunk Interval:** 1 hour
- **Space Partitioning:** By `site_id` (hash partitioning, 16 partitions)
- **Schema:** `timestamp` (TIMESTAMPTZ), `site_id` (INT), `metric_name` (TEXT), `metric_value` (DOUBLE PRECISION), `labels` (JSONB)
- **Continuous Aggregations:**
  - `metrics_hourly` — 1-hour rollup (MIN, MAX, AVG, COUNT per metric per site). Retained 90 days.
  - `metrics_daily` — 1-day rollup. Retained 2 years.
  - `metrics_weekly` — 1-week rollup. Retained indefinitely.
- **Compression:** Enabled on chunks older than 7 days. Typical compression ratio: 10:1 (segment by `site_id`, order by `timestamp`).
- **Retention Policy:** Raw data dropped after 90 days (continuous aggregations preserved). Managed via TimescaleDB's automated retention policies.

## Data Warehouse Integration

The Acme Corp centralized Snowflake data warehouse (managed by the Acme Tech data platform team) serves as the enterprise analytics platform:

- **ETL Tool:** Azure Data Factory with incremental extraction pipelines
- **Nightly ETL Window:** 2:00 AM – 6:00 AM EST
- **Data Sets Exported:**
  - Rated CDRs — incremental, last 24 hours (~500M records/night)
  - Invoice and payment data — incremental, last 24 hours
  - Subscriber master data — full refresh weekly, incremental daily
  - Network KPI aggregations — daily rollup from TimescaleDB
- **Snowflake Schema:** `ACME_TELCO` database with schemas matching source system boundaries (`BILLING`, `SUBSCRIBERS`, `NETWORK`, `PROVISIONING`)
- **Cross-Subsidiary Analytics:** Acme Telco data joined with Acme Financial Services, Acme Retail, and other subsidiaries for group-level customer insights (e.g., identifying Acme Corp customers who use services across multiple subsidiaries)
- **Data Quality Checks:**
  - Row count reconciliation between source and target (tolerance: 0.01%)
  - Hash-based data integrity validation on key financial columns
  - Late-arriving data handling: re-extraction of previous day's data for reconciliation
  - Data freshness monitoring: alerts if ETL completion exceeds 6:00 AM EST

Note: Data warehouse ETL documentation is shared responsibility with the Acme Tech data platform team. Some pipeline configuration details are documented in the Acme Tech knowledge base.

## Data Quality Challenges

### CDR Deduplication

Network elements may generate duplicate CDRs during handovers, retransmissions, or equipment failover events. The mediation system applies composite key matching (subscriber MSISDN + timestamp + event type + duration) with a configurable tolerance window (default: 5 seconds). Duplicate detection catches approximately 0.02% of daily CDR volume. False positive rate (legitimate CDRs incorrectly flagged as duplicates): < 0.001%.

### Timezone Handling

The Acme Telco network spans 2 US time zones (Eastern and Central). Network elements report timestamps in local time. All timestamps are normalized to UTC during the mediation normalization stage. Edge cases around DST transitions (spring forward / fall back) require manual verification — a quarterly audit process reviews CDRs generated during the 2-hour DST transition windows to ensure correct timestamp normalization.

### Roaming Partner Data Quality

Incoming TAP files from roaming partners may have inconsistent formats (TAP3 version variations), delayed delivery (up to 72 hours), or missing fields (particularly location data for non-GPS devices). A dedicated reconciliation process handles roaming CDR quality: TAP file validation, missing field imputation based on partner agreement defaults, and manual review for high-value discrepancies (charge amount variance > $10).

### Subscriber Data Synchronization

The nightly Salesforce-to-PostgreSQL sync has a small but non-zero conflict rate (~0.01%) during high-volume periods (enrollment campaigns, promotional events). Conflict resolution follows data ownership rules: Salesforce wins for profile data (name, address, contact information); internal systems win for usage and billing data. Conflicts are logged and reviewed weekly by the data operations team.

### Late-Arriving CDRs

CDRs arriving after the billing cycle close require adjustment invoices. Current late-arrival rate: ~0.1% of monthly CDR volume. Primary sources of late-arriving CDRs: roaming TAP files (72-hour delivery window), network element buffering during connectivity issues, and manual CDR corrections. Late-arriving CDRs are processed in the next billing cycle with an adjustment line item on the following month's invoice.
