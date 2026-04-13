---
title: "System Landscape and BSS/OSS Inventory"
draft: false
---


# Acme Telco — System Landscape and BSS/OSS Inventory

## Introduction

Acme Telco operates a complex technology landscape spanning Business Support Systems (BSS) and Operations Support Systems (OSS) — the standard architectural separation in telecommunications. This document provides a comprehensive inventory of all production systems, their technology stacks, interdependencies, third-party integrations, and known technical debt.

The BSS/OSS split reflects the dual nature of telco operations: BSS systems handle customer-facing functions (billing, CRM, self-service), while OSS systems manage network-facing functions (monitoring, provisioning, fault management). Understanding this separation is fundamental to navigating Acme Telco's architecture. For business context, see [Acme Telco Business Overview](../business/overview.md).

**Maintenance Note:** This system landscape is maintained by the Platform/SRE team and reviewed quarterly. Some integration details, particularly around Ericsson OSS and Huawei NMS interfaces, rely on institutional knowledge within the Network Operations team and may not be fully captured in written documentation.

## System Inventory

| System | Technology | Database | Purpose | Team |
|--------|-----------|----------|---------|------|
| Billing Mediation | Java 17 / Spring Batch | Oracle 19c | CDR collection, normalization, rating preparation | BSS Engineering |
| Rating & Charging Engine | C++ 17 (custom) | Redis 7 (in-memory) + PostgreSQL 15 | Real-time usage rating, balance management, charging | BSS Engineering |
| CRM Integration Layer | Java 17 / Spring Boot 3 | PostgreSQL 15 | API facade over Salesforce CRM + internal enrichment | BSS Engineering |
| Self-Service Portal | Angular 16 SPA + Java 17 BFF | PostgreSQL 15 | Account management, plan changes, usage dashboard, bill pay | Portal Engineering |
| Network Monitoring | Prometheus + Grafana + custom Java collectors | TimescaleDB | Network KPIs, alarms, capacity planning | OSS/Network Engineering |
| Service Provisioning | Python 3.11 / Django | PostgreSQL 15 | Subscriber activations, plan changes, SIM management | OSS/Network Engineering |
| Fault Management | Java 11 / Spring Boot 2 | PostgreSQL 14 | Network fault correlation, ticketing, SNMP integration | OSS/Network Engineering |

## BSS (Business Support Systems)

BSS systems handle all customer-facing and revenue-related functions. The BSS platform follows a TMForum-inspired architecture and is deployed on Azure, reflecting Acme Telco's cloud-first strategy for subscriber-facing workloads.

**Systems:** Billing Mediation, Rating & Charging Engine, CRM Integration Layer, Self-Service Portal

**Deployment:** Azure (East US region) — AKS for containerized workloads, Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis. The Rating Engine runs on dedicated high-performance Azure VMs due to its C++ runtime requirements (see [ADR-002](../architecture/adr/ADR-002-cpp-rating-engine.md)).

**Communication:** REST APIs for inter-system communication (OpenAPI 3.0 contracts maintained, though some specs may lag behind implementation by 1–2 sprints), gRPC for high-throughput Rating Engine integration.

**Team Ownership:** BSS Engineering team (25 engineers) + Portal Engineering team (15 engineers). BSS Engineering owns billing, rating, and CRM integration. Portal Engineering owns the self-service portal and BFF layer.

## OSS (Operations Support Systems)

OSS systems handle all network-facing and operational functions. These systems are deployed on-premises in the Atlanta data center, co-located with core network infrastructure for low-latency access to network elements.

**Systems:** Network Monitoring, Service Provisioning, Fault Management

**Deployment:** On-premises servers in the Atlanta primary data center. Physical proximity to network equipment is required for sub-millisecond SNMP polling and gRPC streaming telemetry access.

**Communication:** SNMP v3 for device management, gRPC for high-throughput monitoring data, custom protocols for legacy network elements (Ericsson SOAP/XML, Huawei proprietary API). Internal REST APIs between OSS systems.

**Team Ownership:** OSS/Network Engineering team (20 engineers). This team also operates the 24/7 Network Operations Center (NOC) with rotating on-call shifts.

## System Dependency Map

Inter-system dependencies with direction and protocol:

| Source | Target | Protocol | Pattern | Description |
|--------|--------|----------|---------|-------------|
| Billing Mediation | Rating Engine | gRPC | Sync (micro-batch) | Rated CDR submission, 10K CDRs per batch |
| Rating Engine | CRM Integration | REST | Sync | Subscriber plan lookup for rating decisions |
| CRM Integration | Salesforce | REST API + Platform Events | Sync + Async | Customer 360 data, case management |
| Self-Service Portal (BFF) | CRM Integration | REST | Sync | Subscriber data retrieval for portal display |
| Self-Service Portal (BFF) | Rating Engine | gRPC | Sync | Balance queries, usage summary |
| Self-Service Portal (BFF) | Service Provisioning | REST | Sync | Plan changes, SIM management requests |
| Network Monitoring | Fault Management | Internal API | Async (event) | Alarm forwarding for correlation |
| Service Provisioning | Ericsson OSS | SOAP/XML | Sync | Network-level subscriber provisioning |
| Fault Management | Salesforce Service Cloud | REST | Async | Automatic ticket creation for correlated faults |
| All Systems | Network Monitoring | Prometheus scrape | Pull (15s interval) | Metrics exposition via /metrics endpoints |

**BSS-to-OSS Integration:** Integration between BSS and OSS domains is event-driven via Azure Service Bus for asynchronous workflows (e.g., provisioning completion events) and batch-based for reconciliation (daily CDR reconciliation between network and mediation). No synchronous direct dependencies cross the BSS/OSS boundary except for provisioning requests initiated from the Self-Service Portal. See [ADR-001](../architecture/adr/ADR-001-bss-oss-separation.md) for architectural rationale.

## Third-Party Inventory

| Vendor | Product | Integration Protocol | Purpose | Frequency | Contract Status |
|--------|---------|---------------------|---------|-----------|-----------------|
| Salesforce | CRM + Service Cloud | REST API v58.0, Platform Events, Bulk API 2.0 | Customer 360, case management, sales pipeline | Real-time + nightly batch | Active, renewed annually |
| Ericsson | OSS/BSS (RAN management) | SOAP/XML, SNMP v3 | Radio access network management, subscriber provisioning | Synchronous (on-demand) | Multi-year contract |
| Huawei | NMS (Network Management System) | SNMP v3, proprietary API | Transport network monitoring, performance data collection | Polling (60s intervals) | Active, under review |
| Amdocs | Legacy BSS components | Batch file exchange (SFTP), JDBC | Legacy billing reconciliation, historical data migration | Nightly batch | Wind-down phase |

### Integration Details

**Salesforce:** The highest-volume third-party integration. Daily API consumption averages 60,000–80,000 calls against a 100,000/day Enterprise Edition allocation. Peak periods (back-to-school enrollment, holiday promotions) can approach the rate limit ceiling. Platform Events provide near-real-time sync for critical subscriber events. Nightly Bulk API sync processes approximately 4 million subscriber records. Salesforce is the system of record for customer profile data.

**Ericsson OSS:** The most operationally critical vendor integration. SOAP/XML interface handles subscriber provisioning on the radio access network (HLR/HSS updates). Synchronous calls with 30-second timeout and 3-retry logic. Documentation is vendor-maintained and may not be current in this knowledge base.

**Huawei NMS:** Provides transport network monitoring data. SNMP v3 polling supplements Prometheus-based monitoring for equipment not supporting modern telemetry protocols. The proprietary API is used for specific performance metrics not exposed via SNMP. Contract is under review as part of network equipment vendor strategy assessment.

**Amdocs (Legacy):** The remaining Amdocs integration handles billing reconciliation for historical subscriber accounts that predate the current mediation system. Migration of reconciliation functions to the in-house Billing Mediation system is in progress, with expected completion in 6–9 months. During the transition, both systems process a subset of CDRs, requiring daily reconciliation to ensure consistency. Risk: dual-system operation increases complexity and potential for data inconsistencies.

## Technical Debt Register

### Fault Management on Java 11 / Spring Boot 2

**Risk Level:** High — Java 11 is approaching Acme Corp's internal end-of-life policy (end of extended support Q2 2025). Spring Boot 2 reached community end-of-life in November 2023. The Fault Management system has not been upgraded due to the complexity of its SNMP trap processing integrations and correlation engine. Security patches may not be available for newly discovered vulnerabilities. Some newer GHAS CodeQL checks require Java 17+ runtime. Upgrade to Java 17 / Spring Boot 3 is planned but not yet scheduled — pending resource allocation from the OSS team.

### Amdocs Legacy BSS Components

**Risk Level:** Medium — Vendor lock-in with complex data formats and proprietary batch interfaces. Dual-system operation increases operational complexity. Amdocs licensing costs continue during wind-down. Migration to in-house Billing Mediation system is in progress with expected completion in 6–9 months. Parallel processing with daily reconciliation ensures data consistency during transition.

### C++ Rating Engine — Talent Risk

**Risk Level:** Medium — The C++ 17 rating engine is the most performant system in the billing pipeline (50K CDRs/sec capacity) but the available talent pool for C++ developers in the telco domain is limited. Currently 4 developers maintain this system (target: 6). Bus factor concern. gRPC API wrapper reduces the need for direct C++ work. Cross-training program in progress. See [ADR-002](../architecture/adr/ADR-002-cpp-rating-engine.md).

### PostgreSQL Version Fragmentation

**Risk Level:** Low — Four systems run PostgreSQL 15 and one system (Fault Management) runs PostgreSQL 14. Minor version difference adds operational overhead for patching, backup procedures, and monitoring configuration. PostgreSQL 14 upgrade will be bundled with the Java 17 / Spring Boot 3 migration for Fault Management.

## Team Structure

| Team | Size | Responsibility | Key Systems | On-Call |
|------|------|---------------|-------------|---------|
| BSS Engineering | 25 | Billing, rating, CRM integration | Billing Mediation, Rating Engine, CRM Integration | Weekly rotation, 2-person coverage |
| Portal Engineering | 15 | Self-service portal, mobile experience | Self-Service Portal (SPA + BFF) | Weekly rotation, 1-person coverage |
| OSS / Network Engineering | 20 | Network monitoring, provisioning, fault management, NOC | Network Monitoring, Service Provisioning, Fault Management | 24/7 NOC staffing + engineering on-call |
| Platform / SRE | 10 | Infrastructure, CI/CD, observability, security tooling | Cross-cutting (Azure, GitHub Actions, GHAS, monitoring) | Weekly rotation, 1-person coverage |

**Reporting:** All teams report to the Acme Telco VP of Engineering, who reports to the Acme Corp CTO. BSS and Portal teams are co-located in the Atlanta office. OSS/Network team is split between the Atlanta office and the primary data center. Platform/SRE is fully remote with representation across Eastern and Central time zones.

**Collaboration:** BSS and OSS teams hold a weekly cross-domain sync to coordinate changes that span the BSS/OSS boundary (primarily provisioning workflows and billing reconciliation). Platform/SRE participates in all team stand-ups and owns the shared CI/CD and observability infrastructure.

## Infrastructure Overview

**Azure (BSS Workloads):**
- AKS clusters (3 environments: dev, staging, production) running BSS microservices
- Azure Database for PostgreSQL Flexible Server (CRM, Portal, Rating Catalog databases)
- Azure Cache for Redis (Rating Engine subscriber balance cache)
- Azure VM (dedicated high-performance instances for C++ Rating Engine)
- Azure Service Bus (BSS-to-OSS event integration)
- Azure API Management (external API gateway for BSS APIs)
- Azure CDN (Self-Service Portal static asset delivery)

**On-Premises (OSS Workloads):**
- Atlanta primary data center — co-located with core network equipment
- VMware-based virtualization for OSS application servers
- On-premises PostgreSQL instances (Provisioning, Fault Management databases)
- On-premises TimescaleDB (Network Monitoring metrics storage)
- Direct network connectivity to network elements (SNMP, gNMI, SFTP)

**Hybrid Connectivity:**
- Azure ExpressRoute providing dedicated, low-latency connectivity between on-premises data center and Azure East US region
- IPsec VPN as backup connectivity path
- Network segmentation: BSS and OSS workloads on separate VLANs/VNets with firewall rules governing cross-domain traffic

**CI/CD:** GitHub Actions for all teams. GHAS enabled across all repositories with CodeQL scanning, Dependabot, and secret scanning. See [Compliance Overview](../security/compliance-overview.md) for GHAS configuration details.
