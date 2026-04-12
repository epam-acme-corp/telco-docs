---
title: "Billing Mediation System"
---


# Acme Telco — Billing Mediation System

## System Overview

The Billing Mediation system is the entry point for all usage data entering Acme Telco's billing pipeline. Built on Java 17 / Spring Batch and backed by Oracle 19c, it handles the collection, validation, normalization, and enrichment of Call Detail Records (CDRs) from network elements before handing them off to the Rating Engine for charge calculation.

- **Technology:** Java 17 / Spring Batch on Azure Kubernetes Service (AKS)
- **Database:** Oracle 19c (hosted on Azure VM with dedicated storage)
- **Team:** BSS Engineering (part of 25-person team)
- **Daily Volume:** ~500 million CDR records (~2 TB raw data)
- **Processing Model:** Hourly micro-batches + nightly full reconciliation

The mediation system processes CDRs from multiple network element types across Acme Telco's mobile and fixed-line infrastructure. Every CDR represents a billable event — a voice call, an SMS message, a data session, or a premium service charge. Missing or incorrectly processed CDRs directly impact revenue. For the system inventory context, see [System Landscape](system-landscape.md). For the end-to-end billing architecture, see [Architecture Overview](../architecture/overview.md).

## CDR Types

### Voice CDRs
- **Source:** MSC (Mobile Switching Center) via SFTP batch pickup
- **Key Fields:** calling number (A-party), called number (B-party), call duration (seconds), cell ID (originating cell site), call type (local, long distance, international, roaming), call start timestamp, call end timestamp, call termination cause
- **Volume:** ~80 million records/day

### SMS CDRs
- **Source:** SMSC (Short Message Service Center) via SFTP batch pickup
- **Key Fields:** sender MSISDN (MO — Mobile Originated), recipient MSISDN (MT — Mobile Terminated), message type (MO/MT), timestamp, delivery status, message class
- **Volume:** ~40 million records/day

### Data CDRs
- **Source:** Packet core (PGW/UPF) via Apache Kafka streaming
- **Key Fields:** subscriber MSISDN, IMSI, bytes uploaded, bytes downloaded, APN (Access Point Name), session duration, RAT type (4G LTE / 5G NR), QCI (QoS Class Identifier), session start/end timestamps
- **Volume:** ~350 million records/day (largest CDR category by volume)

### Roaming CDRs
- **Source:** Roaming partners via TAP (Transferred Account Procedure) files, delivered via SFTP
- **Key Fields:** visited network PLMN code, home network PLMN code, TAP file format version, roaming agreement reference, usage records (voice, data, SMS), currency and exchange rate, settlement amounts
- **Volume:** ~5 million records/day
- **Note:** TAP files may arrive up to 72 hours after the usage event, requiring special handling for late-arriving data

### Premium Service CDRs
- **Source:** Content provider platforms via REST API callbacks
- **Key Fields:** service ID, content provider identifier, charge amount, subscriber MSISDN, subscriber consent flag, content category, transaction timestamp
- **Volume:** ~25 million records/day

## CDR Lifecycle

### 1. Collection

CDRs are collected from network elements through multiple channels:

- **SFTP Batch Pickup:** Legacy switches and MSC/SMSC nodes deposit CDR files on SFTP servers. The mediation system polls these servers every 15 minutes, downloading new files and tracking processed files via a manifest table in Oracle. File formats: ASN.1 binary (voice, SMS), CSV (legacy fixed-line).
- **Apache Kafka Streaming:** The packet core (PGW/UPF) publishes data session CDRs to a Kafka topic in near-real-time. The mediation system consumes from Kafka with at-least-once delivery semantics. This channel handles the highest-volume CDR type (data sessions).
- **TAP File Ingestion:** Roaming CDRs arrive as TAP3 files from partner networks via SFTP. TAP files follow the GSM Association standard format and are parsed using a specialized TAP3 decoder library.
- **REST API Callbacks:** Premium service CDRs arrive via REST API from content provider platforms, written to a staging table for batch processing.

### 2. Validation

Each CDR undergoes validation checks before further processing:

- **Schema Validation:** Mandatory fields present and data types correct (e.g., MSISDN is numeric, duration is non-negative integer)
- **Range Checks:** Duration > 0, bytes >= 0, timestamps within acceptable range
- **Timestamp Validation:** CDR timestamp is not in the future; timestamp skew does not exceed 24 hours from collection time
- **Duplicate Detection:** Composite key matching (subscriber MSISDN + timestamp + event type + duration) with a configurable tolerance window (default: 5 seconds) to catch retransmitted CDRs
- **Reject Rate:** Approximately 0.05% of CDRs fail validation and are routed to the reject queue

### 3. Normalization

Vendor-specific CDR formats are converted to the internal CDR schema:

- **Format Conversion:** ASN.1 binary decoding (Ericsson, Huawei formats), CSV parsing (legacy), TAP3 decoding (roaming)
- **Number Normalization:** All phone numbers converted to E.164 format (+country code + national number)
- **Timestamp Alignment:** All timestamps normalized to UTC. Network elements in the service footprint span Eastern and Central time zones; DST transition edge cases require manual verification quarterly
- **Unit Conversion:** Voice duration from pulses to seconds, data volume from octets to bytes, currency conversion for roaming CDRs

### 4. Enrichment

Normalized CDRs are enriched with subscriber and business context:

- **Subscriber Lookup:** MSISDN mapped to subscriber ID and account via the CRM Integration API. Cached locally with 5-minute TTL to reduce API call volume.
- **Rate Plan Assignment:** Current rate plan at the time of usage retrieved from the Rating Engine's plan catalog
- **Promotion Applicability:** Active promotions checked against CDR attributes (time of day, destination, data volume) to determine discount eligibility
- **Roaming Partner Identification:** Visited network PLMN code mapped to roaming partner and agreement terms
- **Cell-to-Region Mapping:** Originating cell site ID mapped to geographic region for location-based rating

### 5. Rating Preparation

Enriched CDRs are batched and submitted to the Rating Engine via gRPC:

- **Micro-batch size:** 10,000 CDRs per gRPC request
- **Retry logic:** Exponential backoff (1s, 2s, 4s) for Rating Engine unavailability, max 3 retries
- **Dead Letter Queue:** CDRs that fail after 3 retries are parked in the DLQ for manual investigation
- **Throughput:** Mediation submits at approximately 15K–35K CDRs/sec to the Rating Engine depending on time of day

## Batch Processing Architecture

### Hourly Micro-Batches

Near-real-time processing runs every hour to ensure timely updates:
- Prepaid balance updates are visible within 60 minutes of usage
- Usage dashboard data in the Self-Service Portal reflects recent consumption
- Processing is partitioned by subscriber hash range for parallelism (8 partitions)
- Spring Batch chunk size: 5,000 CDRs per commit

### Nightly Full Batch

A comprehensive reconciliation run executes nightly (12 AM – 4 AM EST):
- Re-processes the full day's CDRs against final rate plan snapshots
- Catches late-arriving CDRs (especially roaming TAP files)
- Applies retroactive plan changes effective during the billing day
- Generates billing-ready aggregation tables for monthly invoice generation
- Reconciles CDR counts between collection, validation, and rating stages

### Job Configuration

Spring Batch jobs are configured with:
- Partitioned processing by subscriber hash range (8 partitions for hourly, 16 for nightly)
- Chunk-oriented processing with configurable chunk sizes (5K hourly, 10K nightly)
- Skip policy: up to 100 CDR processing failures per job step before job failure
- Retry policy: 3 retries for transient failures (database timeouts, gRPC unavailability)
- Job monitoring via Spring Batch Admin dashboard and custom Prometheus metrics

## Error Handling

### CDR Reject Queue

Invalid CDRs are routed to the `CDR_REJECT` table in Oracle with a rejection reason code. Common rejection reasons: missing mandatory fields (35%), duplicate detection (25%), invalid timestamp (20%), subscriber not found (15%), other validation failures (5%). The operations team reviews rejected CDRs via an internal admin tool; correctable CDRs are resubmitted after manual fix.

### Revenue Leakage Alerts

Automated monitoring triggers alerts when:
- Reject rate exceeds 0.1% of daily volume
- High-value CDR types (roaming, premium services) show unusual reject patterns
- CDR volume from a specific network element drops below expected baseline (may indicate collection failure)
- Rating Engine submission failures exceed threshold (potential billing delay)

### Dead Letter Queue

CDRs that fail Rating Engine submission after 3 retries are parked in the DLQ. The DLQ is monitored by the BSS on-call team and investigated within 4 hours during business hours. Common DLQ causes: Rating Engine maintenance window, rate plan catalog inconsistency, subscriber data mismatch.

### Reconciliation

Daily reconciliation verifies data integrity across the pipeline:
- **Count reconciliation:** CDRs collected vs. CDRs validated vs. CDRs rated (expected variance < 0.1%)
- **Value reconciliation:** Total rated charges compared against expected range based on historical patterns
- **Network reconciliation:** CDR counts per network element compared against network element activity logs

## Oracle Schema Overview

Key tables in the mediation database (the full DDL contains 200+ tables; this overview covers the most frequently referenced structures):

- **CDR_RAW** — Raw CDR records as received from network elements. Partitioned by `collection_date` (daily partitions, 90-day retention online). Indexed on `(collection_date, source_element, processing_status)`.
- **CDR_VALIDATED** — CDRs that have passed validation. Same partitioning as CDR_RAW. Additional index on `(subscriber_msisdn, event_timestamp)`.
- **CDR_ENRICHED** — Validated CDRs with subscriber and business context added. Partitioned by `collection_date`. Primary query table for rating preparation jobs.
- **CDR_REJECT** — Invalid CDRs with rejection reason codes. Retention: 180 days. Reviewed by operations team for manual reprocessing.
- **CDR_BATCH_LOG** — Spring Batch job execution history. Used for reconciliation, troubleshooting, and SLA reporting.

**Performance Considerations:** Bulk inserts use Oracle array binding for throughput optimization. Parallel query is enabled for reconciliation reports. Partition pruning is critical for query performance — all queries should include `collection_date` predicates. Archive partitions older than 90 days are moved to cold storage but remain queryable via Oracle's In-Memory Database Cache (not frequently accessed).

Note: The Oracle schema overview covers key tables only. The full DDL (200+ tables) is maintained in the database team's repository and is not reproduced here.
