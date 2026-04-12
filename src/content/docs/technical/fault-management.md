---
title: "Fault Management"
---


# Acme Telco — Fault Management

## System Overview

The Fault Management system processes network alarms, correlates them to identify root causes, and integrates with the ticketing system for incident tracking and resolution. It is a critical component of the NOC's incident management workflow.

- **Technology:** Java 11 / Spring Boot 2 on on-premises servers
- **Database:** PostgreSQL 14
- **Deployment:** On-premises, Atlanta data center
- **Team:** OSS/Network Engineering (part of 20-person team)

> **Technical Debt Notice:** This system is running Java 11 (approaching Acme Corp's internal end-of-life policy, end of extended support Q2 2025) and Spring Boot 2 (community end-of-life reached November 2023). An upgrade to Java 17 / Spring Boot 3 is planned but not yet scheduled. GHAS code scanning is active, but some newer CodeQL vulnerability checks require Java 17+ and are not applicable to this codebase. This is the highest-priority technical debt item for the OSS team.

For system context, see [System Landscape](system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

## Fault Correlation

Multiple alarms from different network elements often indicate a single underlying root cause. The correlation engine reduces alarm noise and helps NOC operators focus on actual faults rather than symptoms.

### Correlation Methods

**Topological Correlation:** Alarms from network elements in the same physical path (e.g., a fiber route, a backhaul chain) are grouped and analyzed. If a transport link fails, all downstream cell sites will generate alarms — topological correlation identifies the transport link as the probable root cause.

**Temporal Correlation:** Alarms occurring within a configurable time window (default: 5 minutes) are grouped for analysis. A burst of alarms in a short period typically indicates a single event affecting multiple elements, rather than independent failures.

**Pattern Matching:** Known failure signatures are encoded as correlation rules. Examples:
- "3+ cell sites in the same geographic area losing backhaul simultaneously" -> likely transport ring failure
- "Core network attach rate spike followed by mass detach" -> likely packet core issue
- "Multiple SNMP traps with OID matching power supply failure" -> likely power event at site or data center

**Correlation Effectiveness:** Typical alarm reduction ratio is 10:1 — 100 raw alarms correlate to approximately 10 distinct faults. During major events (e.g., severe weather), the ratio can reach 50:1 or higher.

### Known Limitation

Some correlation rules are maintained as tribal knowledge by senior network engineers and have not been fully formalized into the rule engine. The NOC team is working on documenting these rules, but the effort is ongoing. New engineers rely on shadowing senior staff to learn event correlation patterns not captured in the system.

## Alarm Processing

### SNMP Trap Processing

Network elements send SNMP traps to the Fault Management system when they detect fault conditions:
- Traps are received via a dedicated SNMP trap listener on the management network
- Trap PDUs are parsed against loaded MIBs (vendor-specific Ericsson and Huawei MIBs)
- Parsed alarms are enriched with network element metadata (site name, region, element type, criticality)

### Alarm Severity Classification

| Severity | Definition | Response Required |
|----------|-----------|-------------------|
| Critical | Service-affecting fault with confirmed subscriber impact | Immediate — NOC + on-call engineer |
| Major | Service-degrading condition with potential subscriber impact | Prompt — within 15 minutes |
| Minor | Non-service-affecting condition requiring attention | Standard — within 4 hours |
| Warning | Informational condition trending toward a problem | Review — next business day |

### Alarm Lifecycle

1. **Raised:** Network element sends SNMP trap; alarm created in Fault Management database
2. **Acknowledged:** NOC operator or on-call engineer acknowledges the alarm, indicating awareness
3. **Under Investigation:** Engineer assigned and actively working on diagnosis and resolution
4. **Cleared:** Fault resolved — either automatically (network element sends clear trap) or manually (engineer confirms resolution)

Alarm suppression is applied during planned maintenance windows to prevent false alarm generation. Maintenance windows are scheduled via the NOC calendar system and automatically applied to the alarm processing pipeline.

## Ticketing Integration

Correlated faults automatically create tickets in Salesforce Service Cloud:

- **Ticket Content:** Fault summary, affected network elements (list with element type and location), estimated subscriber impact count, correlation details (related alarms, probable root cause), severity classification
- **Bidirectional Sync:** Ticket status updates in Salesforce are reflected back in the Fault Management system. Engineers can update tickets from either system.
- **Escalation Rules:** Unacknowledged critical faults automatically escalate after 10 minutes (NOC manager notified). Unresolved critical faults escalate to VP of Engineering after 2 hours.
- **Post-Incident:** Tickets include fields for root cause analysis, corrective actions, and preventive measures. Major incidents require a post-mortem document linked to the ticket.

## SLA Impact Assessment

The Fault Management system estimates subscriber impact for each correlated fault:

- **Impact Estimation:** Based on the coverage area and subscriber density of affected network elements. Cell site subscriber counts are sourced from the Network Monitoring system's capacity data.
- **SLA Clock:** Starts when the fault is first detected (alarm raised timestamp), not when the ticket is created or acknowledged. This ensures accurate SLA measurement.
- **SLA Targets:** Critical fault restoration < 4 hours, major fault restoration < 8 hours
- **SLA Reporting:** Real-time dashboard tracks open faults against SLA targets. Weekly SLA compliance report generated automatically and distributed to engineering leadership.

## Known Issues and Documentation Gaps

- **Java 11 / Spring Boot 2 Upgrade:** The highest-priority tech debt item. Upgrade planning is dependent on validating SNMP trap processing compatibility with Spring Boot 3 and testing all correlation rules against the new runtime. No scheduled date yet.
- **Correlation Rules Documentation:** Approximately 60% of active correlation rules are documented in the system's rule configuration files. The remaining 40% exist as tribal knowledge among 3 senior network engineers. Formalization effort is tracked internally.
- **SNMP Trap Configuration:** Documentation for SNMP trap processing configuration and MIB mappings was last updated 18 months ago. Current MIB versions may differ from what is documented, particularly for Huawei transport equipment that received a firmware update in the interim.
- **PostgreSQL 14:** Will be upgraded to PostgreSQL 15 as part of the Java 17 / Spring Boot 3 migration.
