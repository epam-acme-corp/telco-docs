---
title: "Rating and Charging Engine"
draft: false
---


# Acme Telco — Rating & Charging Engine

## System Overview

The Rating & Charging Engine is the performance-critical core of Acme Telco's billing pipeline, responsible for applying rate plans to CDRs and managing prepaid subscriber balances. Built in C++ 17 for maximum throughput, it processes approximately 500 million CDR records daily with peak capacity of 50,000 CDRs/second.

- **Technology:** C++ 17 (custom-built)
- **In-Memory Store:** Redis 7 Cluster (subscriber balances and session state)
- **Persistent Store:** PostgreSQL 15 (rate plan catalog, rating history, audit trail)
- **API:** gRPC for all external integration
- **Deployment:** Dedicated high-performance Azure VMs (not containerized — see [ADR-002](../architecture/adr/ADR-002-cpp-rating-engine.md))
- **Team:** BSS Engineering (4 C++ developers within the 25-person team)

For the decision rationale behind retaining C++ for this system, see [ADR-002](../architecture/adr/ADR-002-cpp-rating-engine.md). For the upstream CDR processing pipeline, see [Billing Mediation](billing-mediation.md). For system context, see [System Landscape](system-landscape.md).

## Real-Time Rating

### Online Charging (Prepaid)

Online charging handles prepaid subscribers who require real-time balance management. Every usage event must be authorized against the subscriber's current balance before the network grants service.

**Request Flow:**
1. Billing Mediation submits CDR via gRPC `RateAndCharge` method
2. Rating Engine performs subscriber balance lookup in Redis (`sub:{msisdn}` hash)
3. Rate plan applied to determine charge amount
4. Balance reservation created (for session-based events like data sessions)
5. On session completion: final charge calculated and balance debited

**Session-Based Charging:**
- Data sessions use a reservation model: initial balance reservation at session start
- Interim updates every 60 seconds adjust the reservation based on actual usage
- Final debit calculated and applied at session close
- If a session exceeds the reserved amount, an additional reservation is attempted

**Balance Threshold Alerts:**
- Push notifications triggered when balance drops below configurable threshold (default: $5)
- Notification sent via integration with the CRM platform's messaging service
- Subscribers can configure custom thresholds through the Self-Service Portal

**Zero-Balance Handling:**
- When prepaid balance reaches zero, a session termination signal is generated
- Signal sent back to the network via Diameter protocol integration
- Grace period: 60 seconds after zero-balance detection to allow session cleanup
- Zero-balance subscribers can still make E911 emergency calls (regulatory requirement)

### Offline Rating (Postpaid)

Offline rating processes postpaid subscriber CDRs where charges accumulate against a billing account without real-time balance checks.

**Request Flow:**
1. Billing Mediation submits CDR batch via gRPC `RateCDR` method
2. Rate plan retrieved from PostgreSQL catalog (cached in application memory)
3. Charge amount calculated based on plan rules, bundle allowances, and promotions
4. Rated CDR with charge amount returned to Mediation
5. Rated CDRs stored in PostgreSQL for monthly invoice generation

**Key Difference from Online:** No balance check or reservation. Charges accumulate until the monthly billing cycle when an invoice is generated. This allows batch optimization — offline rating processes CDRs in larger batches with relaxed latency requirements.

## Rating Logic

### Rate Plans

Rate plans follow a hierarchical structure:
- **Base Plan:** Monthly service fee, included allowances (data, voice, SMS)
- **Add-Ons:** Optional supplementary packages (international calling, extra data, device insurance)
- **Promotions:** Time-limited discounts or bonus allowances (e.g., "double data for 3 months")
- **One-Time Adjustments:** Credits, refunds, or manual charges applied by customer service

Rating priority: one-time adjustments > promotions > add-ons > base plan. The most specific applicable rule takes precedence.

### Tiered Pricing

Data usage follows tiered pricing models:
- **Example (Unlimited Plus Plan):** First 10 GB at $0 (included), 10–20 GB at $10/GB overage, beyond 20 GB: throttled to 1 Mbps (no additional charge)
- Tier boundaries tracked per billing cycle in Redis counters
- Tier resets at billing cycle start (prorated for mid-cycle plan changes)

### Bundle Allowances

Included minutes, SMS, and data per billing cycle:
- Tracked in Redis as decrementing counters per subscriber
- Separate counters for: voice minutes (on-net vs. off-net), SMS count, data bytes
- When bundle is exhausted, charges switch to overage rates defined in the rate plan
- Bundle rollover: not currently supported (considered for future implementation)

### Roaming Surcharges

- Per-country rate multipliers applied on top of base plan rates
- Daily roaming caps: maximum daily charge for voice/data while roaming (configurable per country group)
- Roaming data passes: fixed-price daily/weekly data packages for international travel
- Roaming partner identification: PLMN code lookup against partner agreement database

### Promotional Discounts

- Time-limited percentage or fixed-amount discounts on specific charge categories
- Loyalty rewards: automatic discounts based on subscriber tenure (e.g., 5% after 12 months)
- Referral credits: one-time credits applied when referred subscriber activates
- Promotional stacking rules: maximum 2 concurrent promotions per subscriber

### Tax Calculation

- Integration with external tax engine for jurisdiction-specific tax application
- Tax jurisdictions determined by subscriber billing address and usage location
- Federal excise tax, state/local telecommunications taxes, USF surcharges, E911 surcharges
- Tax amounts calculated per line item and stored with the rated CDR

## Redis Architecture

### Data Structures

- **Subscriber Balance:** Hash per subscriber keyed as `sub:{msisdn}` with fields for monetary balance, data remaining (bytes), voice minutes remaining, SMS count remaining, last update timestamp
- **Active Sessions:** Sorted set per subscriber for active data/voice sessions with session ID, reservation amount, and expiry timestamp
- **Bundle Counters:** Hash per subscriber per billing cycle tracking allowance consumption
- **Rate Plan Cache:** Hash per plan ID with plan rules (TTL: 1 hour, refreshed from PostgreSQL)

### Cluster Topology

- 6-node Redis Cluster: 3 primary nodes + 3 replica nodes
- Hash slot distribution across primaries for data partitioning
- Automatic failover: replica promoted to primary within 15 seconds of primary failure
- Cross-slot operations avoided — subscriber data co-located by MSISDN hash tag

### Persistence and Recovery

- **RDB Snapshots:** Every 5 minutes for point-in-time recovery
- **AOF (Append-Only File):** Enabled for durability, fsync policy: every second
- **Recovery:** On node restart, AOF replay restores state to within 1 second of last write
- **Backup:** Daily RDB snapshots replicated to Azure Blob Storage

### Memory Management

- **Total Memory:** ~12 GB for 3.2 million mobile subscriber balance records
- **Per-Subscriber Footprint:** ~4 KB average (balance + session state + bundle counters)
- **Eviction Policy:** `noeviction` — all subscriber data must be memory-resident at all times
- **Memory Monitoring:** Prometheus alerts at 80% and 90% memory utilization thresholds

## PostgreSQL Usage

- **Rate Plan Catalog:** Versioned rate plans with effective date ranges. New plan versions created for any rate change; old versions retained for historical rating accuracy. Approximately 200 active rate plans, 2,000 historical versions.
- **Rating History:** Rated CDR archive for audit and dispute resolution. Partitioned by rating date, 180-day online retention, archived thereafter.
- **Reconciliation Tables:** Daily aggregation of rated charges by subscriber and charge category, used as input for the monthly invoice generation process.

## Throughput and Performance

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Peak Throughput | 50K CDRs/sec | ~35K sustained, 50K burst | Capacity expansion planned for 5G growth |
| Average Throughput | — | ~15K CDRs/sec | Follows diurnal traffic pattern |
| Online Charging Latency (p99) | < 5ms | 2.1ms | Prepaid balance check + debit |
| Offline Rating Latency (p99) | < 50ms | 18ms | Batch-optimized postpaid rating |
| Redis Lookup Latency (p99) | < 1ms | 0.3ms | Sub-millisecond balance queries |

Evening hours (7 PM – 10 PM EST) represent peak traffic. Capacity planning targets 50K CDRs/sec to accommodate projected 5G traffic growth (15% annual CDR volume increase). Current headroom: approximately 30% above average sustained throughput.

## gRPC API Surface

| Method | Type | Description | Primary Consumer |
|--------|------|-------------|-----------------|
| `RateAndCharge` | Unary | Online charging for prepaid — balance check, reservation, debit | Billing Mediation |
| `RateCDR` | Server streaming | Offline rating for postpaid — batch CDR rating | Billing Mediation |
| `GetBalance` | Unary | Subscriber balance query (monetary + bundle remaining) | Self-Service Portal BFF |
| `UpdateRatePlan` | Unary | Rate plan catalog update (admin operation) | BSS Admin tools |
| `ReconciliationReport` | Unary | Daily aggregation data for billing handoff | Billing Mediation (nightly) |

The gRPC API is the sole integration point for the Rating Engine. All consuming systems interact through this interface — no direct database access or Redis access is permitted from external systems. API documentation is maintained as Protocol Buffer (.proto) definitions in the Rating Engine repository.

Note: The rating engine's internal C++ architecture is documented in code comments but a separate design document has not been created — this is a known documentation gap. The gRPC API surface documented here reflects the external-facing contract.
