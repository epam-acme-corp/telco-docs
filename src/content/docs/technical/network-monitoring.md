---
title: "Network Monitoring"
---


# Acme Telco — Network Monitoring

## System Overview

The Network Monitoring system provides real-time visibility into Acme Telco's telecommunications network, covering radio access, transport, and core network layers. It is the primary tool for the 24/7 Network Operations Center (NOC) and feeds data to capacity planning, fault management, and executive reporting.

- **Technology:** Prometheus + Grafana for metric collection and visualization; custom Java SNMP/gNMI collectors for network element telemetry
- **Database:** TimescaleDB (on PostgreSQL 15) for long-term metric storage and capacity planning analytics
- **Deployment:** On-premises, Atlanta data center (co-located with core network equipment)
- **Team:** OSS/Network Engineering (part of 20-person team)

For system context, see [System Landscape](system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

## Monitored KPIs

### Radio Access Network (RAN)

| KPI | Target | Alert Threshold | Description |
|-----|--------|----------------|-------------|
| Call Setup Success Rate | > 99.5% | < 99.0% | Percentage of call attempts that successfully establish |
| Call Drop Rate | < 0.5% | > 1.0% | Percentage of established calls that drop unexpectedly |
| Handover Success Rate | > 99% | < 98% | Percentage of successful handovers between cells |
| Cell Congestion Rate | < 70% busy hour | > 80% | Traffic load vs. capacity during peak hours |
| 4G/5G Data Throughput | Varies by cell | < 50% of expected | Per-cell downlink/uplink throughput |

### Transport Network

| KPI | Target | Alert Threshold | Description |
|-----|--------|----------------|-------------|
| Link Utilization | < 70% average | > 85% | Bandwidth consumption as percentage of capacity |
| End-to-End Latency | < 20ms core | > 50ms | Round-trip latency across transport links |
| Jitter | < 5ms | > 10ms | Latency variation — critical for VoLTE quality |
| Packet Loss | < 0.01% | > 0.05% | Packet loss rate on core transport links |

### Core Network

| KPI | Target | Alert Threshold | Description |
|-----|--------|----------------|-------------|
| Attach/Detach Rate | Baseline +/- 20% | > 50% deviation | Subscriber session establishment rate |
| Data Session Success Rate | > 99.9% | < 99.5% | Percentage of data sessions successfully established |
| DNS Resolution Time | < 10ms | > 50ms | Average DNS lookup time for subscriber queries |
| Gateway Throughput | < 80% capacity | > 90% | Internet gateway traffic vs. provisioned capacity |

### Service-Level KPIs

| KPI | Target | Description |
|-----|--------|-------------|
| Network Availability | 99.95% | Overall network uptime across all regions |
| MTTD (Mean Time to Detect) | < 5 minutes | Average time from fault occurrence to detection |
| MTTR (Mean Time to Restore) | < 4 hours (critical) | Average time from detection to service restoration |

## Data Collection Architecture

### SNMP Polling

Custom Java collectors poll network elements using SNMP v3 (authentication + encryption):

- **Polling Interval:** 60 seconds (configurable per element type; critical core nodes polled every 30 seconds)
- **Network Elements:** ~5,000 devices polled (cell site equipment, routers, switches, core network nodes, transport equipment)
- **SNMP Version:** v3 exclusively (v2c legacy being phased out — see [Compliance Overview](../security/compliance-overview.md))
- **MIB Management:** Vendor-specific MIBs (Ericsson RAN, Huawei transport) loaded into collector configuration. MIB updates coordinated with vendor software upgrades.
- **Data Flow:** SNMP collector -> Prometheus remote_write -> TimescaleDB for long-term storage

### gNMI Streaming Telemetry

Newer 5G equipment and modern core network nodes support gNMI (gRPC Network Management Interface) for streaming telemetry:

- **Streaming Interval:** 10 seconds for high-resolution monitoring
- **Coverage:** ~30% of network elements (5G sites and recently deployed core nodes). Coverage expanding as legacy equipment is replaced.
- **Advantages:** Reduces polling overhead, provides near-real-time visibility, supports event-driven notifications for state changes
- **Data Flow:** gNMI stream -> custom Java collector -> Prometheus remote_write -> TimescaleDB

### Syslog Ingestion

Network elements send syslog messages for event-based data:

- **Event Types:** Interface up/down transitions, authentication events (login/logout on device CLI), configuration changes, environmental alerts (temperature, power)
- **Pipeline:** Rsyslog receives syslog messages -> structured parsing -> metric extraction -> Prometheus Pushgateway for relevant metrics
- **Retention:** Syslog messages retained 90 days in TimescaleDB, 1 year in compressed archive
- **Volume:** ~2 million syslog messages per day across all network elements

## Alerting Architecture

Prometheus Alertmanager handles rule-based alerting with severity-based routing and escalation:

### Severity Levels and Routing

| Severity | Routing | Response Time | Example |
|----------|---------|---------------|---------|
| Critical | NOC pager + on-call network engineer + management notification | Acknowledge within 5 minutes | Major site outage, core network failure |
| Major | NOC pager + on-call engineer | Acknowledge within 15 minutes | Degraded performance on key link, partial cell outage |
| Minor | NOC dashboard + email notification | Review within 4 hours | Single cell congestion, minor link degradation |
| Warning | Dashboard only | Next business day | Trending toward threshold, non-critical anomaly |

### Alert Management

- **PagerDuty Integration:** Critical and major alerts routed to PagerDuty with automatic escalation chains. Unacknowledged critical alerts escalate to the engineering manager after 10 minutes and to the VP of Engineering after 30 minutes.
- **Alert Suppression:** Maintenance windows suppress alerts for planned work. Window schedule managed via a maintenance calendar integrated with the alerting system.
- **Correlated Alert Grouping:** During large-scale events (e.g., transport link failure affecting multiple sites), Alertmanager groups related alerts to prevent alert storms. Grouping rules: same geographic region within a 5-minute window.
- **Alert Tuning:** Monthly review of alert efficacy — false positive rate, alert-to-incident ratio, and mean time to acknowledge. Target false positive rate: < 10%.

## Capacity Planning

TimescaleDB continuous aggregations power capacity planning analytics:

- **Hourly/Daily/Weekly Rollups:** Continuous aggregation policies automatically compute metric summaries at multiple time granularities
- **Trend Analysis:** Linear regression on traffic growth data for 3-month, 6-month, and 12-month projections. Models updated weekly with latest data.
- **Threshold Alerts:** Automated alerts when traffic trends toward capacity limits (e.g., cell site approaching 80% peak-hour utilization within 3-month projection)
- **Capacity Reports:**
  - Weekly automated reports per region distributed to network planning team
  - Monthly executive summary with regional heat maps and investment recommendations
  - Quarterly capacity review with engineering leadership to prioritize expansion

## Dashboards

All dashboards are built in Grafana and serve different audiences:

- **NOC Wall Display:** Regional overview with real-time health status map, active alarm count by severity, top-5 KPI summary, network availability ticker. Auto-refreshes every 30 seconds.
- **Per-Region Drill-Down:** Site-level detail including individual cell traffic patterns, alarm history, capacity utilization, and maintenance schedule. Used by NOC operators for incident investigation.
- **Executive Dashboard:** High-level KPIs (network availability, subscriber-impacting incidents, SLA compliance), 30-day trend analysis, and quarter-over-quarter comparison. Refreshed hourly.
- **Incident Dashboard:** Active incidents with timeline, affected subscriber count estimate, restoration progress tracker, and linked fault management tickets. Real-time updates during active incidents.

All dashboards are embedded in the NOC web portal and accessible to authorized personnel via VPN. Dashboard access is role-based: NOC operators see operational views, engineering team sees technical detail, and executives see summary views.
