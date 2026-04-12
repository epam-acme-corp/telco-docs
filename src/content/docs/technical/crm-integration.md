---
title: "CRM Integration Layer"
---


# Acme Telco — CRM Integration Layer

## System Overview

The CRM Integration Layer acts as an API facade that unifies Salesforce CRM data with internal telco system data to provide a complete subscriber 360 view. It is the central integration point between Acme Telco's internal systems and the Salesforce CRM platform.

- **Technology:** Java 17 / Spring Boot 3 on Azure Kubernetes Service (AKS)
- **Database:** PostgreSQL 15 (local cache and enrichment data)
- **Team:** BSS Engineering
- **Purpose:** Unified subscriber view combining Salesforce CRM data with billing, usage, network, and support data from internal systems

For system context, see [System Landscape](system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

## Salesforce Integration

### REST API Integration

The primary integration mechanism for real-time subscriber data operations:

- **Account CRUD:** Create, read, update subscriber accounts in Salesforce
- **Contact Management:** Primary account holder and authorized user management
- **Case Management:** Support ticket creation, status tracking, resolution updates
- **Opportunity Tracking:** Upsell/cross-sell pipeline for enterprise accounts
- **API Version:** Salesforce REST API v58.0
- **Authentication:** OAuth 2.0 JWT Bearer flow (service-to-service, no user interaction)
- **Rate Limit:** 100,000 API calls/day (Enterprise Edition allocation). Average daily consumption: 60,000–80,000 calls. Peak periods can approach the ceiling during high-volume enrollment campaigns.

### Platform Events

Real-time event-driven sync for critical subscriber lifecycle events:

- **`Subscriber_Status_Change__e`** — Account activation, suspension, termination, reactivation
- **`Payment_Received__e`** — Payment confirmation, triggering balance and dunning status updates
- **`Plan_Change__e`** — Rate plan changes, add-on additions/removals

Events are consumed via CometD long-polling subscription. The platform event replay mechanism provides a 24-hour replay window for missed events — if the CRM Integration service is down for maintenance, it can replay events from the last known position on restart. Event processing is idempotent (duplicate delivery does not cause data inconsistency).

### Bulk API

Nightly full synchronization of subscriber account data:

- **Protocol:** Salesforce Bulk API 2.0 for efficient large-dataset transfers
- **Sync Window:** 1:00 AM – 4:00 AM EST (off-peak hours)
- **Volume:** ~4 million subscriber records per nightly sync
- **Direction:** Salesforce -> PostgreSQL local cache (full refresh)
- **Conflict Resolution:** Salesforce is the system of record for customer profile data (name, address, contact info). Internal systems are the system of record for usage and billing data. In case of conflict, data ownership determines which value prevails.

Known issue: Salesforce API rate limits occasionally cause sync delays during high-volume enrollment periods (back-to-school, holiday promotions). The bulk sync job implements adaptive throttling to stay within rate limits but may extend beyond the 4:00 AM target window during peak enrollment.

## Internal Enrichment

The CRM Integration Layer supplements Salesforce subscriber data with information from internal telco systems. Enrichment is performed at query time (not pre-computed) to ensure data freshness:

- **Network Usage:** Real-time data, voice, and SMS consumption from the Rating Engine via gRPC `GetBalance` method. Cache TTL: 5 minutes.
- **Billing Status:** Current balance, last payment date, dunning status, next invoice date from Billing Mediation. Cache TTL: 1 hour.
- **Support History:** Historical ticket data, average resolution time, satisfaction scores from Salesforce case history. Cache TTL: 24 hours.
- **Network Quality:** Per-subscriber network experience metrics (signal quality, throughput) from Network Monitoring aggregations. Cache TTL: 1 hour.

Caching is implemented using local PostgreSQL with TTL-based invalidation. Cache hit rate averages 85% during business hours, significantly reducing backend API call volume.

## Subscriber 360 View

The Subscriber 360 API provides a comprehensive, aggregated view of a subscriber's relationship with Acme Telco:

**Endpoint:** `GET /api/v1/subscribers/{msisdn}/360`

**Response includes:**
- **Account Details:** Name, address, contact info, account status, creation date, contract terms
- **Current Plan:** Plan name, monthly fee, included allowances, active add-ons, contract end date
- **Usage Summary:** Current billing cycle data/voice/SMS consumed vs. allowance, percentage used
- **Billing Summary:** Last invoice amount, payment status, auto-pay enrollment, outstanding balance
- **Recent Support Interactions:** Last 5 support tickets with status, category, and resolution
- **Network Experience Score:** Composite score based on signal quality and throughput at frequently used cell sites

**Primary Consumers:** Self-Service Portal (subscriber self-service), call center agent desktop, retention team dashboards, enterprise account management portal.

## Data Mapping

| Salesforce Object | Internal Entity | Sync Direction | Frequency |
|-------------------|-----------------|----------------|-----------|
| Account | Subscriber | Bidirectional | Real-time (Platform Events) + nightly (Bulk API) |
| Contact | AccountHolder | Salesforce -> Internal | Nightly bulk sync |
| Case | SupportTicket | Bidirectional | Real-time (Platform Events) |
| Opportunity | UpsellLead | Salesforce -> Internal | Nightly bulk sync |
| Product2 | RatePlan | Internal -> Salesforce | On rate plan change (event-driven) |

## Operational Considerations

**Circuit Breaker:** Resilience4j circuit breaker pattern protects against Salesforce API failures. When Salesforce API error rate exceeds 50% over a 60-second window, the circuit opens and requests are served from the local PostgreSQL cache (degraded mode). Circuit half-opens after 30 seconds to test recovery.

**Degraded Mode:** When Salesforce is unavailable, the CRM Integration Layer serves subscriber data from its local PostgreSQL cache. Cached data may be up to 24 hours stale (last nightly sync). Degraded mode is transparent to consumers — the API response includes a `dataFreshness` field indicating whether data is live or cached.

**Monitoring:**
- Salesforce API quota consumption tracked in Prometheus with alerts at 80% daily threshold
- Platform Event processing lag monitored (alert if lag exceeds 5 minutes)
- Bulk sync job duration and record count tracked for anomaly detection
- Cache hit/miss ratios monitored for enrichment data sources

**Known Issue:** The Salesforce integration documentation was last comprehensively reviewed 6 months ago. Some newer Platform Event types added by the Salesforce admin team may not be documented in this knowledge base. The CRM Integration service processes all subscribed events regardless of documentation status.
