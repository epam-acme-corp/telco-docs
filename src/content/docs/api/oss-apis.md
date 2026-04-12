---
title: "OSS API Reference"
---


# Acme Telco — OSS API Reference

## Introduction

This document provides the API reference for Acme Telco's Operations Support System (OSS) APIs. These APIs are internal-only, not exposed through the API Gateway, and accessible only from the management network via API key + IP whitelist authentication.

For the API landscape overview, see [API Overview](overview.md). For architecture context, see [Architecture Overview](../architecture/overview.md). For the systems that implement these APIs, see [Network Monitoring](../technical/network-monitoring.md), [Service Provisioning](../technical/service-provisioning.md), and [Fault Management](../technical/fault-management.md).

> **Documentation Note:** OSS APIs are internal-only and maintained by the OSS/Network Engineering team. Some documentation may be slightly out of date — the OSS team prioritizes operational stability over documentation currency. Endpoint specifications below reflect the last documented state and should be verified against the current implementation for critical integrations.

## Network Monitoring API

**Base Path:** `/internal/api/v1/monitoring`
**Authentication:** API key (`X-API-Key` header) + source IP whitelist
**Team:** OSS/Network Engineering

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/alarms` | List active alarms (filterable by severity, site, time range) |
| GET | `/alarms/{id}` | Get alarm details |
| PUT | `/alarms/{id}/acknowledge` | Acknowledge an alarm |
| GET | `/alarms/summary` | Get alarm count by severity |
| GET | `/metrics/{site_id}` | Get current metrics for a site |
| GET | `/metrics/{site_id}/history` | Get historical metrics (time range query) |

### GET /alarms

**Query Parameters:**
- `severity` — Filter by severity: `critical`, `major`, `minor`, `warning`
- `site_id` — Filter by network site identifier
- `since` — Alarms raised after this timestamp (ISO 8601)
- `status` — Filter by status: `active`, `acknowledged`, `cleared`
- `page` — Page number (default: 1)
- `page_size` — Results per page (default: 50, max: 200)

**Response Example (200 OK):**
```json
{
  "alarms": [
    {
      "alarmId": "ALM-2025-01-18-00423",
      "severity": "critical",
      "source": {
        "elementId": "eNB-ATL-0847",
        "elementType": "eNodeB",
        "siteName": "Atlanta-Midtown-Tower-3",
        "region": "Georgia-Metro"
      },
      "description": "Cell site backhaul link down - primary fiber path",
      "raisedAt": "2025-01-18T09:23:15Z",
      "status": "active",
      "subscriberImpactEstimate": 12500,
      "correlatedFaultId": "FLT-2025-01-18-00089",
      "acknowledgedBy": null,
      "acknowledgedAt": null
    },
    {
      "alarmId": "ALM-2025-01-18-00419",
      "severity": "major",
      "source": {
        "elementId": "RTR-ATL-CORE-02",
        "elementType": "router",
        "siteName": "Atlanta-Core-DC",
        "region": "Georgia-Metro"
      },
      "description": "Interface GigabitEthernet0/1 utilization exceeds 90% threshold",
      "raisedAt": "2025-01-18T09:15:42Z",
      "status": "acknowledged",
      "subscriberImpactEstimate": 0,
      "correlatedFaultId": null,
      "acknowledgedBy": "noc-operator-jsmith",
      "acknowledgedAt": "2025-01-18T09:18:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 127
  }
}
```

### GET /metrics/{site_id}/history

**Query Parameters:**
- `metric_name` — Metric to retrieve (e.g., `cell_throughput_dl`, `link_utilization`, `packet_loss`)
- `from` — Start timestamp (ISO 8601)
- `to` — End timestamp (ISO 8601)
- `resolution` — Data resolution: `raw`, `hourly`, `daily` (default: `hourly`)

**Response Example (200 OK):**
```json
{
  "siteId": "eNB-ATL-0847",
  "metricName": "cell_throughput_dl",
  "unit": "Mbps",
  "resolution": "hourly",
  "dataPoints": [
    {"timestamp": "2025-01-18T08:00:00Z", "value": 245.7},
    {"timestamp": "2025-01-18T09:00:00Z", "value": 312.4},
    {"timestamp": "2025-01-18T10:00:00Z", "value": 287.1}
  ]
}
```

## Provisioning API

**Base Path:** `/internal/api/v1/provisioning`
**Authentication:** API key (`X-API-Key` header) + source IP whitelist
**Team:** OSS/Network Engineering

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/activate` | Activate new subscriber |
| POST | `/plan-change` | Change subscriber plan |
| POST | `/sim-swap` | Process SIM swap |
| POST | `/esim-provision` | Provision eSIM profile |
| GET | `/provisioning-status/{id}` | Check provisioning request status |
| GET | `/sim-inventory` | Query SIM inventory |

### POST /activate

Initiates new subscriber activation including SIM allocation, HLR/HSS provisioning, and rate plan assignment.

**Request Example:**
```json
{
  "msisdn": "+14045557890",
  "iccid": "8901260871234567890",
  "subscriberId": "SUB-2025-01-18-00142",
  "planId": "POSTPAID-UNLIMITED-PLUS",
  "activationType": "new_subscriber",
  "simType": "physical",
  "requestSource": "retail_pos",
  "requestedBy": "store-agent-atlanta-042"
}
```

**Response Example (202 Accepted):**
```json
{
  "provisioningRequestId": "PROV-2025-01-18-00542",
  "msisdn": "+14045557890",
  "status": "in_progress",
  "steps": [
    {"step": "sim_allocated", "status": "complete", "timestamp": "2025-01-18T11:30:01Z"},
    {"step": "hlr_provisioned", "status": "in_progress"},
    {"step": "rate_plan_assigned", "status": "pending"},
    {"step": "welcome_message_sent", "status": "pending"},
    {"step": "crm_updated", "status": "pending"}
  ],
  "estimatedCompletionTime": "2025-01-18T13:30:00Z"
}
```

### GET /provisioning-status/{id}

Returns the current status of a provisioning request with step-by-step progress.

### GET /sim-inventory

**Query Parameters:**
- `sim_type` — Filter: `physical`, `esim`
- `status` — Filter: `available`, `allocated`, `activated`, `deactivated`
- `page`, `page_size`

Returns SIM inventory counts and available stock by type and status.

## Fault Management API

**Base Path:** `/internal/api/v1/faults`
**Authentication:** API key (`X-API-Key` header) + source IP whitelist
**Team:** OSS/Network Engineering

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/faults` | List correlated faults |
| GET | `/faults/{id}` | Get fault details with correlation info |
| POST | `/faults/{id}/ticket` | Create support ticket for a fault |
| PUT | `/faults/{id}/status` | Update fault status |
| GET | `/faults/statistics` | Fault statistics (MTTD, MTTR by category) |

### GET /faults/{id}

Returns detailed fault information including correlated alarms, affected network elements, and associated ticket.

**Response Example (200 OK):**
```json
{
  "faultId": "FLT-2025-01-18-00089",
  "severity": "critical",
  "description": "Transport ring failure - Atlanta Midtown segment",
  "probableCause": "Fiber cut on primary path between ATL-AGG-03 and ATL-AGG-05",
  "status": "under_investigation",
  "detectedAt": "2025-01-18T09:23:15Z",
  "acknowledgedAt": "2025-01-18T09:25:00Z",
  "assignedTo": "noc-engineer-mwilliams",
  "correlatedAlarms": [
    {"alarmId": "ALM-2025-01-18-00423", "elementId": "eNB-ATL-0847", "severity": "critical"},
    {"alarmId": "ALM-2025-01-18-00424", "elementId": "eNB-ATL-0848", "severity": "critical"},
    {"alarmId": "ALM-2025-01-18-00425", "elementId": "eNB-ATL-0851", "severity": "critical"},
    {"alarmId": "ALM-2025-01-18-00426", "elementId": "RTR-ATL-AGG-03", "severity": "major"}
  ],
  "affectedNetworkElements": 4,
  "subscriberImpactEstimate": 37500,
  "slaTarget": "4 hours",
  "slaDeadline": "2025-01-18T13:23:15Z",
  "ticketId": "TKT-NOC-2025-01-18-00089",
  "restorationProgress": "Field technician dispatched to fiber route"
}
```

### GET /faults/statistics

Returns fault management performance metrics over a specified time period.

**Query Parameters:**
- `from` — Start date (ISO 8601)
- `to` — End date (ISO 8601)
- `groupBy` — Group results: `severity`, `region`, `element_type`

**Response Example (200 OK):**
```json
{
  "period": "2025-01-01 to 2025-01-18",
  "statistics": {
    "totalFaults": 47,
    "bySeverity": {
      "critical": 3,
      "major": 12,
      "minor": 32
    },
    "mttd": {
      "average": "3.2 minutes",
      "p95": "8.1 minutes"
    },
    "mttr": {
      "critical": "2.8 hours",
      "major": "5.4 hours",
      "minor": "12.1 hours"
    },
    "slaMet": {
      "critical": "100%",
      "major": "92%"
    }
  }
}
```

## OSS API Conventions

### Common Patterns

- **Response Format:** All OSS APIs return JSON (despite SOAP/XML legacy in the Ericsson integration layer)
- **Timestamps:** UTC in ISO 8601 format
- **Pagination:** Offset-based using `page` and `page_size` parameters. Default page size: 50.
- **Versioning:** No formal API versioning policy currently in place (internal APIs with a single consumer team). URL-based versioning (`/v1/`) is used as a namespace but breaking changes have historically been coordinated directly between teams. Formal versioning is recommended for future stability.

### Error Response Format

```json
{
  "error": "ALARM_NOT_FOUND",
  "message": "No alarm with ID ALM-2025-01-18-99999",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `ALARM_NOT_FOUND` | No alarm matches the provided ID |
| `FAULT_NOT_FOUND` | No fault matches the provided ID |
| `PROVISIONING_REQUEST_NOT_FOUND` | No provisioning request matches the provided ID |
| `SIM_NOT_AVAILABLE` | Requested SIM type not available in inventory |
| `ERICSSON_OSS_UNAVAILABLE` | Network provisioning backend is temporarily unavailable |
| `INVALID_PARAMETER` | Request parameter validation failure |

## Known Documentation Gaps

- **Network Monitoring API:** The `/metrics` endpoints were added in a recent sprint. The response format documentation above reflects the current known contract, but some recently added metric types may include additional fields not documented here.
- **Provisioning API:** The `/esim-provision` endpoint was added recently and request validation rules are documented in code comments but not yet formalized in this specification. Integration consumers should test against the staging environment for the latest behavior.
- **Fault Management API:** Some fields in the fault response are dynamically added by the correlation engine based on which correlation rules matched. These dynamic fields are not enumerated in this document — consumers should handle unknown fields gracefully.
- **General:** OSS API documentation updates are part of an ongoing improvement initiative tracked by the Platform/SRE team. The goal is to achieve OpenAPI 3.0 specification parity with BSS APIs by end of year.
