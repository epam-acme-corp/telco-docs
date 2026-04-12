---
title: "ADR-001 BSS/OSS Separation"
---


# ADR-001: Maintain Strict BSS/OSS Separation

## Status

Accepted (retroactively documented — original decision circa 2019, documented in ADR format in 2022)

## Context

Prior to 2019, Acme Telco operated with a partially shared infrastructure between BSS and OSS systems. Several production incidents exposed the risks of this coupling:

**Incident 1 (March 2019):** During a major network alarm storm caused by a transport link failure affecting 40+ cell sites, the Fault Management system generated a high volume of database writes to log alarm events. Because the Fault Management database shared an Oracle RAC cluster with the Billing Mediation system, the increased I/O load caused lock contention on shared tablespaces. This resulted in CDR processing delays of 6+ hours, which in turn caused prepaid balance updates to stop — approximately 200,000 prepaid subscribers could not see their current balance and some were incorrectly denied service.

**Incident 2 (June 2019):** A Spring Boot version upgrade to the Service Provisioning system required a shared CI/CD pipeline that was also used by the CRM Integration Layer. The pipeline change introduced a test environment configuration that inadvertently affected the CRM Integration staging environment, causing a 2-day delay in the CRM team's release cycle during a critical enrollment period.

These incidents highlighted three categories of coupling risk: database-level (shared storage causing cross-system performance interference), deployment-level (shared CI/CD pipelines causing release dependencies), and operational-level (shared infrastructure making blast radius unpredictable during incidents).

## Decision

Enforce strict separation between BSS and OSS systems across all architectural layers:

1. **Separate databases:** No shared database instances between BSS and OSS systems. Each system maintains its own database with independent connection pools, backup schedules, and performance tuning.
2. **Separate deployments:** BSS systems deployed on Azure (cloud); OSS systems deployed on-premises (Atlanta data center). No shared compute infrastructure.
3. **Separate CI/CD pipelines:** Each system has its own GitHub Actions workflows. No shared pipeline steps or shared test environments between BSS and OSS systems.
4. **Event-based integration:** BSS-to-OSS communication uses Azure Service Bus for asynchronous events or SFTP for batch file transfers. No shared database connections, no synchronous cross-domain API calls (with one documented exception: provisioning requests from the Self-Service Portal).
5. **Independent on-call rotations:** BSS and OSS teams maintain separate on-call schedules and incident management processes.

## Consequences

### Positive

- **Operational isolation:** BSS outages do not cascade to network operations, and network alarm storms do not impact billing or customer-facing systems. Blast radius is contained within a domain.
- **Independent release cycles:** BSS teams deploy multiple times per day; OSS teams deploy weekly during maintenance windows. Neither domain blocks the other.
- **Team autonomy:** BSS and OSS teams can make independent technology choices (e.g., BSS moved to Azure while OSS remains on-premises; BSS adopted Spring Boot 3 while OSS Fault Management remains on Spring Boot 2).
- **Clear ownership:** Every system has a single owning team with full authority over its technology stack, release cadence, and operational procedures.

### Negative

- **Cross-domain reporting complexity:** Business reports that span BSS and OSS data (e.g., correlating network quality metrics with subscriber churn) require joins in the Snowflake data warehouse rather than direct database queries. This adds latency (nightly ETL) and complexity to analytics workloads.
- **Provisioning workflow complexity:** Subscriber provisioning spans both domains (BSS for plan assignment, OSS for network configuration). The event choreography between domains requires careful coordination and has more failure modes than a direct synchronous call.
- **Data duplication:** Some data exists in both BSS and OSS databases (e.g., subscriber MSISDN, plan identifiers). Consistency is maintained through event-driven sync, but eventual consistency windows exist.
- **Operational overhead:** Two separate infrastructure environments (Azure + on-premises) require distinct operational practices, monitoring configurations, and incident response procedures.

## Related Decisions

- [ADR-002: Retain C++ Rating Engine](ADR-002-cpp-rating-engine.md) — independent of BSS/OSS separation but reflects BSS team's autonomy in technology choices
- Azure migration for BSS workloads was a downstream decision enabled by this separation
