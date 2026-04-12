---
title: "Service Provisioning"
---


# Acme Telco — Service Provisioning

## System Overview

The Service Provisioning system manages subscriber lifecycle operations — activations, plan changes, SIM management, and number porting. It is the bridge between business processes (subscriber sign-up, plan change requests) and network-level configuration (HLR/HSS updates, QoS profile changes).

- **Technology:** Python 3.11 / Django on on-premises servers
- **Database:** PostgreSQL 15
- **Deployment:** On-premises, Atlanta data center
- **Team:** OSS/Network Engineering (part of 20-person team)
- **Integration:** Ericsson OSS for network-level provisioning commands

For system context, see [System Landscape](system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

## Provisioning Workflows

### New Subscriber Activation

| Step | Action | System | Duration |
|------|--------|--------|----------|
| 1 | Activation request received | Portal / Retail POS / CRM | — |
| 2 | SIM inventory check and allocation | Provisioning (PostgreSQL) | < 1 sec |
| 3 | HLR/HSS subscriber profile creation | Ericsson OSS (SOAP/XML) | 5–30 sec |
| 4 | Rate plan assignment notification | Rating Engine (REST) | < 1 sec |
| 5 | Welcome SMS/email triggered | CRM Integration (REST) | < 5 sec |
| 6 | Subscriber status updated to Active | CRM Integration -> Salesforce | < 10 sec |

**SLA Target:** Activation completed within 4 hours of request submission.
**Actual Performance:** 90% completed within 2 hours, 99% within 4 hours. Most activation time is consumed by the Ericsson OSS step (HLR/HSS provisioning), which may queue during high-volume periods.

### Plan Change

| Step | Action | System | Duration |
|------|--------|--------|----------|
| 1 | Plan change request validated | Provisioning (eligibility check, contract term check) | < 1 sec |
| 2 | Rating Engine updated with new plan | Rating Engine (REST) | < 1 sec |
| 3 | Network profile updated (if QoS change) | Ericsson OSS (SOAP/XML, only if speed tier changes) | 5–30 sec |
| 4 | Subscriber notified via SMS/email | CRM Integration (REST) | < 5 sec |
| 5 | CRM updated with new plan details | CRM Integration -> Salesforce | < 10 sec |

**SLA Target:** Plan change effective within 15 minutes.
**Actual Performance:** 95% within 10 minutes, 99% within 15 minutes. Plan changes that do not require QoS updates (most downgrades and lateral moves) complete in under 1 minute.

### Number Porting — Port-In

| Step | Action | Duration |
|------|--------|----------|
| 1 | Port-in request received with subscriber authorization | — |
| 2 | Number ownership verification with losing carrier via NPAC | 1–4 hours |
| 3 | Port scheduled (minimum 1 business day lead time per FCC regulations) | 1 business day |
| 4 | Port execution: network configuration updated, number activated | 15–60 minutes |
| 5 | Confirmation sent to subscriber | < 5 minutes |

**Volume:** ~5,000 port-in requests per month
**Success Rate:** ~97% (failures typically due to authorization issues — subscriber name/account number mismatch with losing carrier, or outstanding balance preventing release)

### Number Porting — Port-Out

| Step | Action | Duration |
|------|--------|----------|
| 1 | Port-out request received from gaining carrier via NPAC | — |
| 2 | Authorization validated (subscriber account in good standing) | < 1 hour |
| 3 | Network configuration removed (HLR/HSS profile deactivated) | 15–30 minutes |
| 4 | Subscriber account updated to ported-out status | < 5 minutes |
| 5 | Final bill generated with prorated charges | Next billing cycle |

Port-out requests are processed automatically when authorization validates successfully. Disputed port-outs follow the NPAC dispute resolution process.

### SIM Management

- **SIM Inventory:** PostgreSQL-based inventory tracking for both physical SIM cards and eSIM profiles. Inventory is replenished through vendor purchase orders with automated reorder triggers at minimum stock thresholds.
- **SIM Swap:** Replacement for lost, stolen, or damaged SIMs. Requires subscriber identity verification (in-store with government ID, or phone-based with CPNI PIN). SIM swap completes within 15 minutes of verification.
- **eSIM Provisioning:** QR code generation for eSIM-capable devices. Profile download initiated by subscriber scanning the QR code. eSIM profiles managed through Apple/Samsung/Google device management protocols.
- **Multi-SIM:** Support for wearable devices (smartwatches) sharing a subscriber's number and plan. Multi-SIM provisioning creates a secondary profile linked to the primary subscriber account.

## Ericsson OSS Integration

The Ericsson OSS interface is the critical path for network-level provisioning:

- **Protocol:** SOAP/XML over HTTPS
- **Operations:** Subscriber create, subscriber modify, subscriber delete, QoS profile update, service feature activation/deactivation
- **Timeout:** 30-second synchronous call timeout
- **Retry Logic:** 3 attempts with exponential backoff (2s, 4s, 8s)
- **Fallback:** When Ericsson OSS is unavailable (maintenance window, connectivity issue), provisioning requests are queued in PostgreSQL. A background job processes the queue when connectivity is restored, with FIFO ordering.
- **Monitoring:** Ericsson OSS response times and error rates tracked in Prometheus. Alert triggered when error rate exceeds 5% or average response time exceeds 15 seconds.

**Known Limitation:** Ericsson OSS interface documentation is vendor-maintained. The SOAP/XML schema definitions are provided by Ericsson and may be updated during vendor software upgrades. Acme Telco maintains a local copy of the WSDL files, but they may not always reflect the latest vendor interface version. Critical provisioning changes are validated in a pre-production environment before deployment.

## Provisioning Monitoring

- **Django Admin Dashboard:** Real-time view of provisioning queue depth, active workflows, and recent completions/failures. Used by the provisioning operations team during business hours.
- **Prometheus Metrics:** Provisioning request rate (by workflow type), success/failure rate, latency distribution, Ericsson OSS response times, queue depth
- **Alerting:** Failure rate > 5% triggers PagerDuty alert to on-call provisioning engineer. Queue depth > 500 triggers capacity alert. Ericsson OSS unavailability triggers immediate NOC notification.
- **Daily Report:** Automated daily summary of provisioning activity — request volumes by type, SLA compliance, failure analysis, and queue health metrics.
