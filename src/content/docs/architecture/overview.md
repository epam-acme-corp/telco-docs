---
title: "Architecture Overview"
---


# Acme Telco — Architecture Overview

## Introduction

Acme Telco's architecture follows a TMForum-inspired BSS/OSS separation pattern that has evolved over the past decade. This document covers the high-level architecture, communication patterns, deployment model, and the end-to-end CDR (Call Detail Record) data flow that underpins the billing pipeline.

Architecture decisions at Acme Telco are recorded in ADR format. The ADR practice was adopted approximately three years ago; earlier decisions were retroactively documented where the rationale could be reconstructed. Key ADRs are linked from this document. For the complete system inventory, see [System Landscape](../technical/system-landscape.md). For business context, see [Business Overview](../business/overview.md).

## BSS/OSS Split Architecture

The fundamental architectural principle at Acme Telco is the strict separation between Business Support Systems (BSS) and Operations Support Systems (OSS). This separation, documented in [ADR-001](adr/ADR-001-bss-oss-separation.md), is enforced at the deployment, database, and network level.

**BSS (Business Support Systems)** handle all customer-facing and revenue-related functions:
- **Billing Mediation** — CDR collection, validation, normalization, and enrichment
- **Rating & Charging Engine** — Real-time usage rating and prepaid balance management
- **CRM Integration Layer** — Unified subscriber 360 view combining Salesforce and internal data
- **Self-Service Portal** — Customer-facing web application for account management

**OSS (Operations Support Systems)** handle all network-facing and operational functions:
- **Network Monitoring** — Real-time network KPIs, alarms, and capacity planning
- **Service Provisioning** — Subscriber activations, plan changes, and SIM management
- **Fault Management** — Network fault correlation, ticketing, and SNMP trap processing

BSS and OSS do not share databases or maintain direct synchronous dependencies. Integration between the two domains is event-driven (Azure Service Bus) or batch-based (SFTP file transfers), with one exception: provisioning requests initiated from the Self-Service Portal flow synchronously through the BFF to the Provisioning system.

## Communication Patterns

### BSS Internal Communication

Synchronous REST APIs connect BSS systems. OpenAPI 3.0 contracts are maintained for all BSS internal APIs, though some specifications may lag behind implementation by 1–2 sprints. Key patterns:

- **CRM Integration <-> Rating Engine:** gRPC for high-throughput subscriber plan lookups and balance queries
- **Self-Service Portal BFF -> CRM Integration:** REST for subscriber data retrieval
- **Self-Service Portal BFF -> Rating Engine:** gRPC for real-time balance and usage queries
- **Billing Mediation -> Rating Engine:** gRPC for rated CDR submission (micro-batches of 10K CDRs)

### OSS Internal Communication

OSS systems communicate using a mix of protocols reflecting the diversity of network equipment interfaces:

- **SNMP v3:** Primary protocol for network device management and monitoring (authentication + encryption)
- **gRPC / gNMI:** Streaming telemetry from modern 5G equipment (10-second intervals)
- **SOAP/XML:** Legacy protocol for Ericsson OSS provisioning commands
- **Proprietary API:** Huawei NMS integration for transport network monitoring
- **Internal REST:** Between OSS application services (monitoring, fault management, provisioning)

### BSS-to-OSS Integration

- **Azure Service Bus:** Asynchronous event integration for workflows spanning both domains (e.g., provisioning completion events, billing reconciliation triggers)
- **SFTP:** Daily batch file transfers for CDR reconciliation between network elements and the mediation system
- **Direct REST (exception):** Self-Service Portal BFF calls Provisioning API for subscriber-initiated service changes

### External Integration

- **Salesforce:** REST API v58.0 + Platform Events + Bulk API 2.0 (see [CRM Integration](../technical/crm-integration.md))
- **Ericsson OSS:** SOAP/XML for RAN provisioning commands
- **Huawei NMS:** SNMP v3 + proprietary API for transport monitoring
- **Payment Processor:** Redirect-based integration for PCI-DSS scope reduction

## Network Architecture

```
RAN (Radio Access Network)
  +-- Cell Sites --> eNodeB (4G) / gNodeB (5G)
  +-- Small Cells (urban densification)
  \-- Backhaul (fiber + microwave)
        |
        v
Transport Network
  +-- Metro Aggregation (ring topology)
  \-- Core Transport (MPLS backbone)
        |
        v
Core Network
  +-- Packet Core (EPC for 4G / 5GC for 5G)
  +-- IMS (IP Multimedia Subsystem - VoLTE, VoWiFi)
  +-- DNS / DHCP (subscriber session management)
  \-- Internet Gateway (peering + transit)
        |
        v
BSS Platform (Azure East US)
  +-- Billing Mediation --> Rating Engine --> Invoice Generation
  +-- CRM Integration <--> Salesforce
  \-- Self-Service Portal (Angular SPA + Java BFF)
```

**RAN (Radio Access Network):** Approximately 2,800 cell sites across the southeastern US footprint, a mix of macro towers and small cells. 4G LTE is the primary technology with 5G NR deployed in 15 metro markets. Backhaul connectivity is primarily fiber with microwave links for rural sites.

**Transport Network:** MPLS backbone connecting metro aggregation rings to core network nodes. Designed for 99.999% availability with redundant paths. Carries both subscriber traffic and network management traffic (SNMP, gNMI).

**Core Network:** The Evolved Packet Core (EPC) handles 4G subscriber sessions; the 5G Core (5GC) is deployed in non-standalone (NSA) mode anchored to the EPC. IMS provides VoLTE voice services. Internet gateway handles peering with major content providers and transit providers.

**BSS Platform:** All customer-facing and billing systems deployed on Azure, connected to the on-premises core network via Azure ExpressRoute. CDRs flow from network elements through the mediation and rating pipeline to generate subscriber invoices.

## Deployment Architecture

### BSS — Azure (Cloud)

- **Region:** Azure East US (primary), Central US (DR)
- **Compute:** Azure Kubernetes Service (AKS) for containerized microservices; dedicated Azure VMs for the C++ Rating Engine
- **Data:** Azure Database for PostgreSQL Flexible Server, Azure Cache for Redis, Oracle 19c on Azure VM
- **Messaging:** Azure Service Bus for async BSS-to-OSS integration
- **API Gateway:** Azure API Management for external-facing BSS APIs
- **CDN:** Azure CDN for Self-Service Portal static assets
- **DR strategy:** Azure paired regions with active-passive failover. RTO: 4 hours, RPO: 1 hour for critical BSS systems

### OSS — On-Premises (Atlanta Data Center)

- **Compute:** VMware vSphere cluster for OSS application servers
- **Data:** On-premises PostgreSQL 14/15, TimescaleDB
- **Network access:** Direct connectivity to network elements via management VLANs
- **DR strategy:** Secondary data center (warm standby) with database replication. RTO: 8 hours, RPO: 4 hours for OSS systems

### Hybrid Connectivity

Azure ExpressRoute provides dedicated, low-latency connectivity between the Atlanta data center and Azure East US region. This link carries BSS-to-OSS event traffic, provisioning API calls, and CDR data transfers. IPsec VPN serves as a backup path. Network segmentation enforces the BSS/OSS boundary — BSS VNets and OSS VLANs communicate only through designated firewall rules.

**Rationale for hybrid deployment:** OSS systems require physical proximity to network equipment for sub-millisecond SNMP polling and gRPC streaming telemetry. BSS systems benefit from cloud elasticity to handle subscriber-facing traffic peaks (bill cycle day, promotional enrollment periods). This hybrid model is common in telecommunications organizations transitioning to cloud.

## CDR Data Flow: Network to Invoice

The Call Detail Record (CDR) lifecycle is the central data flow in Acme Telco's architecture, transforming raw network usage events into subscriber invoices.

### 1. Generation

Network elements (MSC switches, SMSC, packet core nodes) generate raw CDRs for each subscriber event — voice calls, SMS messages, data sessions, and roaming events. Raw CDRs are encoded in ASN.1 binary format (voice/SMS) or structured logs (data sessions). Daily volume: approximately 500 million CDR records (~2 TB raw data).

### 2. Collection

Billing Mediation collects CDRs through multiple channels:
- **SFTP batch pickup** — Every 15 minutes from legacy switches and MSC nodes
- **Apache Kafka streaming** — Near-real-time from packet core for data session CDRs
- **TAP file ingestion** — Roaming CDRs from partner networks (may arrive up to 72 hours delayed)

### 3. Normalization

Mediation normalizes CDR formats from vendor-specific encodings (Ericsson, Huawei, legacy) to the internal CDR schema. Processing includes ASN.1 binary parsing, number normalization to E.164 format, timestamp alignment to UTC, and unit conversion (pulses to seconds for voice, octets to bytes for data).

### 4. Enrichment

Each CDR is enriched with subscriber context: MSISDN-to-subscriber-ID mapping (via CRM Integration API), current rate plan assignment, applicable promotions, roaming partner identification, and cell-to-region mapping for geographic rating.

### 5. Rating

The Rating Engine applies rate plans and calculates charges. Online charging (prepaid) involves real-time balance checks and debits via Redis. Offline rating (postpaid) applies rate plan rules and returns charge amounts. Peak throughput: 50K CDRs/sec. See [Rating Engine](../technical/rating-engine.md) for details.

### 6. Aggregation

Rated CDRs are aggregated by subscriber and billing period. Charge categories (voice, data, SMS, roaming, premium services) are summed. Adjustments (credits, disputes, late-arriving CDRs) are applied.

### 7. Invoice Generation

Monthly invoices are generated from aggregated charges plus taxes (external tax engine integration) plus adjustments. Invoices are rendered as PDF and structured data, stored in Oracle 19c.

### 8. Delivery

Invoices are delivered via the Self-Service Portal (default), email notification with PDF attachment, and postal mail (opt-in). Payment processing is handled by a third-party processor for PCI-DSS scope reduction.

## Integration Patterns Summary

| Integration | Pattern | Protocol | SLA | Notes |
|-------------|---------|----------|-----|-------|
| Mediation -> Rating | Synchronous (micro-batch) | gRPC | p99 < 50ms per batch | 10K CDRs per batch |
| Rating -> CRM Integration | Synchronous | REST | p99 < 200ms | Plan lookup for rating decisions |
| Portal BFF -> CRM Integration | Synchronous | REST | p99 < 500ms | Subscriber data aggregation |
| Portal BFF -> Rating Engine | Synchronous | gRPC | p99 < 100ms | Balance and usage queries |
| Portal BFF -> Provisioning | Synchronous | REST | p99 < 1s | Plan changes, SIM management |
| Network Monitoring -> Fault Mgmt | Asynchronous (event) | Internal API | Best effort | Alarm forwarding |
| BSS -> OSS (provisioning events) | Asynchronous | Azure Service Bus | < 5 min delivery | Provisioning completion notifications |
| Mediation -> Network Elements | Batch | SFTP | 15-min polling cycle | CDR file collection |
| CRM Integration -> Salesforce | Mixed | REST + Events + Bulk | Per Salesforce SLA | 100K API calls/day allocation |
| Fault Mgmt -> Salesforce | Asynchronous | REST | Best effort | Automatic ticket creation |

Note: Some integration patterns between OSS and network elements rely on vendor-specific documentation that is not reproduced here. API specs for BSS internal communication exist but may lag behind implementation by 1–2 sprints.
