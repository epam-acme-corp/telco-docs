---
title: "Security and Regulatory Compliance"
---


# Acme Telco — Security and Regulatory Compliance

## Introduction

Acme Telco operates in one of the most heavily regulated industries in the United States. Telecommunications carriers are subject to federal (FCC) and state regulatory requirements covering lawful intercept capabilities, customer data protection, emergency calling services, and more. Security and compliance are operational prerequisites for maintaining the carrier license.

As a Level 2 (Secured) subsidiary within Acme Corp, Acme Telco has GHAS enabled across all repositories, active code scanning with CodeQL, Dependabot for dependency management, and secret scanning. Copilot has been purchased but adoption is ad-hoc across teams. For system context, see [System Landscape](../technical/system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

## Telecommunications Regulatory Compliance

### FCC Regulations

- **Spectrum Licensing:** Acme Telco holds FCC spectrum licenses for mobile operations across its southeastern US footprint. Compliance includes buildout requirements (spectrum must be actively used), interference management, and annual reporting.
- **Universal Service Fund (USF):** Mandatory revenue-based contributions to the federal USF. Quarterly contribution filings and annual revenue reporting via FCC Form 499.
- **Net Neutrality:** Transparency requirements including public disclosure of network management practices and performance metrics. No paid prioritization of subscriber traffic.
- **Truth-in-Billing:** Invoice formats must be clear, non-misleading, and include itemized charges with descriptions. Compliance verified through periodic internal audits and FCC complaint monitoring.
- **Local Number Portability (LNP):** Mandatory support for subscribers to transfer numbers between carriers. Port-in and port-out processes must complete within FCC-mandated timeframes (see [Service Provisioning](../technical/service-provisioning.md)).
- **Annual Reporting:** FCC Form 477 (broadband deployment data), FCC Form 499 (revenue reporting), and other periodic filings.

### CALEA (Communications Assistance for Law Enforcement Act)

- **Requirement:** Legal obligation to support lawful intercept capabilities for authorized law enforcement surveillance
- **Implementation:** Lawful intercept function integrated with core network packet capture infrastructure
- **Process:** Court-ordered intercept requests are handled exclusively by the dedicated Legal Compliance team. Requests require valid court order or authorized emergency request.
- **Audit:** Annual compliance audit by external assessor verifying technical capability and procedural controls
- **Scope:** CALEA intercept architecture documentation is restricted to personnel with appropriate clearance. Technical details are not included in this knowledge base — this entry serves as a reference only.

### E911 (Enhanced 911)

- **Requirement:** Location-accurate emergency calling for all wireless and VoIP subscribers
- **Implementation:** ALI (Automatic Location Identification) database integration provides subscriber location data to PSAPs (Public Safety Answering Points)
- **Wireless E911 Phase II:** Location accuracy within 50–300 meters depending on technology (GPS-assisted for smartphones, cell-ID triangulation for feature phones)
- **VoLTE E911:** SIP-based emergency call routing with location headers. VoLTE calls routed to the nearest PSAP based on cell site location and subscriber GPS coordinates.
- **Testing:** Quarterly E911 routing tests per FCC requirements. Test results documented and retained for 3 years.

### CPNI (Customer Proprietary Network Information)

- **Scope:** FCC rules governing protection of subscriber usage data, including call records, service usage patterns, and billing information
- **Access Controls:** Subscriber authentication required before disclosing CPNI — PIN-based verification for phone inquiries, identity verification (government ID) for in-store requests, secure login for portal access
- **Technical Controls:** CPNI-classified data fields tagged in database schemas across all systems. Access logging enabled for all CPNI data queries. Role-based access control limits CPNI access to authorized personnel.
- **Annual Certification:** CPNI compliance certification filed with FCC annually, including documentation of security measures and any unauthorized access incidents
- **Breach Notification:** FCC must be notified within 7 business days of any unauthorized CPNI access. Affected subscribers notified per FCC guidelines.

### TCPA (Telephone Consumer Protection Act)

- **Telemarketing Compliance:** Do-not-call (DNC) list management integrated with marketing platforms. Internal DNC database synchronized with the National Do Not Call Registry.
- **Consent Management:** Subscriber communication preferences stored in Salesforce CRM. Opt-in required for marketing communications. Opt-out processed within 30 days (regulatory maximum; actual processing: < 24 hours).
- **Automated Calling/Texting:** Restrictions on automated calls and text messages to subscribers. Prior express consent required for marketing autodialed calls. Transactional messages (billing reminders, service notifications) exempt but must include opt-out mechanism.

## GHAS Configuration and Application Security

### CodeQL Scanning

- **Coverage:** Enabled on all Acme Telco repositories (BSS and OSS codebases)
- **Languages Scanned:** Java (all BSS/OSS services), Python (Service Provisioning), TypeScript (Self-Service Portal Angular SPA)
- **C++ Scanning:** Enabled for the Rating Engine repository. However, CodeQL's C++ analysis covers fewer vulnerability patterns than its Java analysis. This is a known GHAS limitation — critical security-sensitive changes to the C++ codebase receive additional manual code review.
- **Custom Queries:** Telco-specific CodeQL queries configured for: CPNI data exposure in logs, CDR data leaks to non-billing systems, SNMP community string exposure, unencrypted subscriber PII in transit
- **Scan Frequency:** On every pull request and weekly scheduled scans on default branches
- **Alert Triage SLA:** Critical findings triaged within 24 hours, high within 1 week, medium/low within 1 month

### Dependabot

- **Coverage:** Enabled across all repositories
- **Auto-Merge Policy:** Security updates for minor/patch versions are auto-merged after CI passes. Major version updates require manual review and approval.
- **Ecosystem Coverage:** Maven (Java services), pip (Python/Django), npm (Angular portal), Conan (C++ Rating Engine — limited coverage)
- **Known Gap:** C++ dependency management via Conan has a less comprehensive vulnerability database than Maven or npm. Some C++ dependencies require manual security audit on a quarterly basis.

### Secret Scanning

- **Status:** GitHub secret scanning enabled with push protection (prevents commits containing detected secrets)
- **Custom Patterns:** Configured for Acme Telco-specific credential types:
  - Salesforce API tokens and refresh tokens
  - Ericsson OSS service account credentials
  - SNMP community strings (v2c legacy patterns — being phased out)
  - SIM provisioning API keys
  - Oracle database connection strings
  - Redis cluster authentication tokens
- **Alert Routing:** Detected secrets trigger immediate notification to the security team via Slack and email. Remediation SLA: secret rotated within 4 hours of detection.

## Network Security

### Device Management

- **SNMP v3:** All production network element management uses SNMP v3 with authentication (SHA-256) and encryption (AES-256). SNMP credentials rotated semi-annually.
- **Legacy SNMP v2c:** Being phased out across the network. Estimated completion: Q3 2025. Remaining v2c usage is limited to a subset of older transport equipment pending firmware upgrades.
- **SSH Access:** Key-based authentication for device CLI access. Password-based SSH disabled on all network elements. SSH keys rotated annually.
- **Firmware Updates:** Staged rollout process — lab testing, pre-production validation, canary deployment (5% of element type), then full rollout with automated post-update testing.

### API Traffic Security

- **TLS:** TLS 1.2+ required for all API communication — BSS inter-service, BSS-to-OSS, and external integrations. TLS 1.0/1.1 disabled.
- **mTLS:** Mutual TLS for service-to-service communication within AKS clusters. Certificate management via cert-manager with automatic rotation.
- **API Gateway:** Azure API Management for external-facing BSS APIs with rate limiting, OAuth 2.0 token validation, request/response schema validation, and IP-based access policies.
- **Internal OSS APIs:** Not exposed through the API Gateway. Network-segmented on management VLANs with IP whitelist + API key authentication.

### Inter-Site Connectivity

- **IPsec VPN:** Encrypted tunnels for inter-data-center communication (Atlanta primary to DR site)
- **Azure ExpressRoute:** Private peering for on-premises-to-Azure connectivity. Traffic does not traverse the public internet.
- **Network Segmentation:** BSS (Azure VNets) and OSS (on-premises VLANs) on separate network segments with firewall rules governing cross-domain traffic. Only designated integration endpoints are reachable across the boundary.

## Data Retention Policies

| Data Type | Retention Period | Regulatory Basis | Storage Location |
|-----------|-----------------|------------------|-----------------|
| CDR (billing) | 18 months online + 5 years archived | FCC billing dispute rules | Oracle 19c -> cold storage |
| CDR (regulatory) | 5 years minimum | CALEA, state PUC requirements | Archived, retrievable within 48 hours |
| Subscriber PII | Duration of service + 2 years | CCPA, state privacy laws | PostgreSQL (encrypted at rest) |
| Network metrics | 90 days detailed, 2 years aggregated | Internal capacity planning | TimescaleDB -> cold storage |
| CPNI access logs | 3 years | FCC CPNI rules | Centralized log management |
| Payment data | Not stored | PCI-DSS scope reduction | 3rd-party processor only |
| E911 call records | 3 years | FCC E911 regulations | Dedicated secure storage |
| CALEA intercept logs | Per court order | CALEA | Restricted access storage |

## Incident Response

### Network Outage vs. Security Incident

- **Network Outages:** Follow the NOC incident management process — Fault Management system detects the issue, escalation via PagerDuty, restoration coordinated through the NOC, and post-mortem conducted for major incidents.
- **Security Incidents:** Follow the Acme Corp CSIRT (Computer Security Incident Response Team) process — detection, containment, eradication, recovery, lessons learned.
- **Overlap Scenario:** When a network outage is caused by a security incident (e.g., unauthorized access leading to configuration change), both processes are activated simultaneously. CSIRT leads the investigation while NOC leads restoration.
- **Subscriber Communication:** Service-affecting outages trigger subscriber notifications via portal banner, SMS, and social media channels. Communication templates are pre-approved for common outage scenarios.
- **Regulatory Notification:** FCC outage reporting is required for outages affecting 900,000+ subscriber-minutes (calculated as subscribers affected multiplied by outage duration in minutes).

### Security Incident Classification

| Priority | Description | Lead | Notification |
|----------|-------------|------|-------------|
| P1 | Active breach, data exfiltration, CPNI exposure | CSIRT | Executive team, legal, regulatory affairs |
| P2 | Unauthorized access attempt, detected vulnerability exploitation | Security team | Engineering leadership, affected system owners |
| P3 | Policy violation, misconfiguration, failed security control | Security team | System owner, team lead |

## PCI-DSS Compliance

- **Scope:** Minimal — limited to redirect/iframe for bill payment processing on the Self-Service Portal
- **Implementation:** Third-party payment processor handles all card data storage, processing, and transmission. Acme Telco systems never receive, store, or process cardholder data.
- **Compliance Level:** SAQ A (Self-Assessment Questionnaire A) — applicable to merchants that have fully outsourced card data handling
- **Assessment:** Annual PCI-DSS self-assessment questionnaire completed and filed
- **Scanning:** Quarterly ASV (Approved Scanning Vendor) scans on portal infrastructure to verify no card data exposure
