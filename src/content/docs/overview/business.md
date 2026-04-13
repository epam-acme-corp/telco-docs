---
title: "Acme Telco Business Overview"
draft: false
---


# Acme Telco — Business Overview and Subscriber Lifecycle

## Introduction

Acme Telco is Acme Corp's telecommunications subsidiary operating mobile and fixed-line networks across the southeastern United States. Headquartered in Atlanta, Georgia, Acme Telco serves approximately 4 million subscribers — 3.2 million mobile and 800,000 fixed-line — and generates roughly 11% of Acme Corp group revenue. The organization employs approximately 5,000 people spanning network operations, BSS/OSS engineering, customer service, retail, and corporate functions.

Originally established as a regional mobile carrier serving the Atlanta metropolitan area, Acme Telco expanded through a combination of organic growth and targeted acquisitions to cover the broader southeastern US footprint. The addition of fixed-line services (broadband, IPTV, and landline) transformed the company from a mobile-only operator into an integrated telecommunications provider. Today, Acme Telco competes with national carriers while leveraging its regional presence, community relationships, and competitive pricing as key differentiators.

For group-level business context, see [Acme Corp Business Overview](../../acme-corp/business/overview.md).

## Service Offerings

### Mobile Services

**Prepaid Plans** — Pay-as-you-go and monthly reload options targeted at cost-conscious subscriber segments. Prepaid accounts require no credit check and offer predictable spending. Subscribers can reload balances via the self-service portal, retail locations, or authorized reseller channels. Prepaid accounts represent approximately 35% of the mobile subscriber base.

**Postpaid Plans** — Monthly billing with device financing options. This is the core consumer product and the primary revenue driver for mobile services. Postpaid plans include a monthly service fee with bundled data, voice, and SMS allowances. Device financing is available through 24-month and 36-month installment plans. Postpaid accounts represent approximately 50% of the mobile subscriber base.

**Family Plans** — Shared data pools with per-line pricing, representing a significant growth area. Family plans allow up to 8 lines sharing a common data allowance, with individual voice and SMS bundles per line. Pricing is structured with a base charge for the shared pool plus a per-line access fee. Family plans have grown 18% year-over-year, driven by multi-device households.

**Business Plans** — Pooled data with mobile device management (MDM) integration, priority customer support, and dedicated account management. Business plans offer administrative controls for fleet management, usage reporting dashboards, and volume-based discounting. Available for organizations with 5 or more lines.

### Fixed-Line Services

**Broadband** — Fiber-to-the-premises (FTTP) and DSL offerings across metro and suburban footprints. Fiber broadband is available in approximately 60% of the service area with speeds up to 1 Gbps symmetric. DSL service covers legacy copper infrastructure areas with speeds up to 100 Mbps downstream. Broadband is the fastest-growing fixed-line product, with fiber deployment expanding quarterly.

**IPTV** — Bundled television service delivered over broadband infrastructure. The IPTV offering includes live channels, on-demand content library, cloud DVR, and multi-screen viewing. Available exclusively to broadband subscribers as a bundle addon. IPTV subscriber penetration is approximately 40% of broadband households.

**Landline** — Traditional voice service over copper and fiber infrastructure. While declining in the consumer segment (approximately 8% annual subscriber loss), landline remains significant in the enterprise segment where reliability and regulatory requirements (E911, CALEA) make it a continued necessity.

### Enterprise Services

**SD-WAN** — Managed software-defined wide area networking for multi-site businesses. Acme Telco provides the CPE hardware, network configuration, monitoring, and ongoing management. SD-WAN is positioned as a modern replacement for legacy MPLS services, offering cost savings and application-aware routing.

**Dedicated Circuits** — Leased lines for high-bandwidth enterprise customers requiring guaranteed capacity and SLA-backed performance. Available in capacities from 100 Mbps to 10 Gbps, typically used by financial institutions, healthcare providers, and data-intensive businesses.

**Managed Network Services** — Outsourced network management for mid-market businesses that lack in-house networking expertise. Services include LAN/WLAN management, firewall management, and network monitoring with 24/7 NOC support.

## Subscriber Lifecycle

The subscriber lifecycle at Acme Telco follows a well-defined progression from prospect through active service to eventual churn or retention. Each stage involves specific systems, processes, and touchpoints.

### Prospect

Lead generation through retail stores, digital marketing, community events, and partner channels. Prospective subscribers undergo a credit check (soft pull for postpaid eligibility assessment) and receive plan recommendations based on usage patterns and budget. Typical prospect-to-activation conversion rate is approximately 35%. Average time in prospect stage: 1–14 days.

### Activation

SIM card provisioning (physical or eSIM), device setup and configuration, HLR/HSS registration on the mobile network, and welcome messaging (SMS + email). For broadband activations, this stage includes technician dispatch for fiber installation (where applicable) and CPE provisioning. Target activation SLA: 4 hours for mobile, 3–5 business days for broadband. See [Service Provisioning](../technical/service-provisioning.md) for technical details.

### Usage

Voice, data, and SMS consumption during the active service period. Prepaid subscribers see real-time balance tracking with threshold alerts; postpaid subscribers accumulate usage against their plan allowances with overage notifications. Usage data flows from network elements through mediation and rating systems. See [Billing Mediation](../technical/billing-mediation.md) for processing details.

### Billing

Call Detail Records (CDRs) are collected from network elements, processed through the mediation pipeline, rated according to the subscriber's plan, aggregated by billing period, and used to generate invoices. Postpaid subscribers receive monthly invoices; prepaid subscribers have real-time balance deductions. See [Rating Engine](../technical/rating-engine.md) for charging logic.

### Payment

Multiple payment channels are supported: auto-pay (credit card or ACH), self-service portal payment, in-store payment at retail locations, and mail-in check payment. Delinquent accounts enter the dunning process — a series of escalating notifications (SMS, email, IVR call) at 15, 30, 45, and 60 days past due. Accounts exceeding 90 days past due are suspended and referred to collections.

### Churn and Retention

Churn prediction models analyze usage patterns, payment behavior, support interaction frequency, and competitive market signals to identify at-risk subscribers. Retention offers (plan discounts, device upgrade credits, loyalty rewards) are triggered proactively through outbound campaigns. Win-back campaigns target churned subscribers within 90 days of departure. Number porting out (LNP) is handled per FCC regulations with a 1-business-day processing window.

## Subscriber Base Metrics

| Segment | Subscribers | Percentage | Trend |
|---------|------------|------------|-------|
| Mobile — Postpaid | ~1,600,000 | 40% | Stable (+1% YoY) |
| Mobile — Prepaid | ~1,120,000 | 28% | Slight decline (-2% YoY) |
| Mobile — Business | ~480,000 | 12% | Growing (+5% YoY) |
| Fixed-Line — Broadband | ~480,000 | 12% | Strong growth (+12% YoY) |
| Fixed-Line — IPTV | ~192,000 | 5% | Growing (+8% YoY) |
| Fixed-Line — Landline | ~128,000 | 3% | Declining (-8% YoY) |
| **Total** | **~4,000,000** | **100%** | **Net +2% YoY** |

Geographic distribution: Georgia (45%), Alabama (15%), Tennessee (12%), North Carolina (10%), South Carolina (10%), Florida panhandle (8%). Subscriber counts are approximate and updated quarterly.

## Billing Models

**Usage-Based** — Per-minute voice charges and per-megabyte data charges. Primarily used on legacy prepaid plans and some enterprise metered services. Represents approximately 10% of revenue.

**Flat-Rate** — Unlimited plans with a fixed monthly fee covering voice, SMS, and data (with potential deprioritization thresholds). The dominant consumer billing model, representing approximately 45% of revenue.

**Tiered** — Data bucket plans with defined allowances and overage charges. Common in family plans and mid-tier postpaid offerings. Represents approximately 30% of revenue.

**Hybrid** — Base flat-rate fee plus usage-based charges for premium services (international calling, roaming, premium content). Used across all segments for add-on services. Represents approximately 15% of revenue.

## Customer Segments

**Consumer (~70% of subscribers)** — Individuals and families, typically on postpaid or prepaid plans. Price-sensitive with relatively high churn (monthly churn rate: ~1.8%). Average revenue per user (ARPU): $42/month. Primary acquisition channels: retail stores, digital marketing, word-of-mouth.

**SMB (~20% of subscribers)** — Small and medium businesses with 5–100 lines. Value reliability and responsive support over lowest price. Moderate ARPU ($55/month per line). Monthly churn rate: ~1.0%. Typically on 12–24 month contracts with dedicated support representatives.

**Enterprise (~10% of subscribers)** — Large organizations with 100+ lines, dedicated account teams, and custom contract terms. Highest ARPU ($85/month per line) and longest contracts (24–36 months). Monthly churn rate: ~0.3%. Services include mobile fleet management, SD-WAN, dedicated circuits, and managed services.

## Regulatory Environment

Acme Telco operates under a comprehensive regulatory framework governing US telecommunications carriers:

- **FCC Regulations** — Spectrum licensing, Universal Service Fund (USF) contributions, net neutrality compliance (transparency requirements), and truth-in-billing standards
- **State PUCs** — Rate filings, service quality reporting, and consumer complaint resolution for each state in the service footprint (Georgia, Alabama, Tennessee, North Carolina, South Carolina, Florida)
- **LNP (Local Number Portability)** — Mandatory support for subscribers to transfer their phone numbers to and from other carriers within one business day
- **E911** — Location-accurate emergency calling requirements, including Wireless E911 Phase II compliance (location accuracy within 50–300 meters)
- **CALEA** — Communications Assistance for Law Enforcement Act compliance, requiring lawful intercept capabilities
- **CPNI** — Customer Proprietary Network Information protection, with annual FCC certification and strict access controls
- **TCPA** — Telephone Consumer Protection Act compliance for telemarketing, including do-not-call list management and consent-based communications

For detailed security and compliance documentation, see [Compliance Overview](../security/compliance-overview.md).

## Competitive Landscape

Acme Telco competes primarily against national carriers (AT&T, Verizon, T-Mobile) across its southeastern US footprint. The competitive strategy focuses on regional differentiation:

- **Local presence:** 85 retail locations staffed by community members, local sponsorships, and regional customer support centers
- **Competitive pricing:** 10–15% below national carrier pricing on comparable plans
- **Network quality:** Targeted network investment in coverage areas underserved by national carriers
- **Bundle value:** Combined mobile + broadband + IPTV offerings not matched by mobile-only national competitors

The MVNO segment represents both a threat and an opportunity. Acme Telco operates a modest wholesale business providing network access to two regional MVNOs. Cable companies (Comcast, Charter) are the primary competitive threat for broadband services, particularly in areas where both fiber and cable infrastructure overlap. The competitive landscape section reflects current market conditions and should be reviewed annually.

## Key Business Metrics

| Metric | Value | Benchmark |
|--------|-------|-----------|
| Consumer ARPU | $42/month | Industry avg: $48 |
| SMB ARPU | $55/month per line | Industry avg: $52 |
| Enterprise ARPU | $85/month per line | Industry avg: $78 |
| Consumer Monthly Churn | 1.8% | Industry avg: 1.5% |
| SMB Monthly Churn | 1.0% | Industry avg: 1.2% |
| Enterprise Monthly Churn | 0.3% | Industry avg: 0.5% |
| Net Subscriber Adds | ~80,000/year | — |
| Network Uptime | 99.95% (actual) | SLA target: 99.9% |
| NPS — Consumer | 32 | Industry avg: 30 |
| NPS — Enterprise | 48 | Industry avg: 42 |
| Revenue per Employee | ~$220K | Industry avg: $250K |

Metrics are reviewed monthly at the executive level and quarterly with Acme Corp group leadership. Industry benchmarks are sourced from annual CTIA industry reports and internal competitive intelligence.
