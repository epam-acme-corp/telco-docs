---
title: "API Contracts Overview"
draft: false
---


# Acme Telco — API Contracts Overview

## Introduction

Acme Telco exposes APIs across two domains: BSS (Business Support Systems) APIs for subscriber-facing operations and OSS (Operations Support Systems) APIs for network-facing operations. The API landscape is partially aligned with TMForum Open API standards — an industry initiative to standardize telco APIs — though full compliance is a work in progress.

BSS APIs are exposed through Azure API Management with OAuth 2.0 authentication, while OSS APIs are internal-only, network-segmented, and authenticated via API key + IP whitelist. This separation reflects the BSS/OSS architectural boundary described in [ADR-001](../architecture/adr/ADR-001-bss-oss-separation.md). For system context, see [System Landscape](../technical/system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md).

**Documentation Note:** API specifications are maintained in OpenAPI 3.0 format for BSS APIs, but some specs may lag behind implementation by 1–2 sprints. OSS API documentation is less formal — some endpoints are documented in internal wikis rather than structured API specs. This is a known gap that the Platform/SRE team is working to address.

## API Landscape

### BSS APIs (Subscriber-Facing)

- **Subscriber Management API** — CRUD operations on subscriber accounts and the subscriber 360 view
- **Billing API** — Invoice retrieval, payment processing, payment history
- **Plan Management API** — Plan catalog browsing, plan change requests, add-on management
- **Self-Service API** — Support ticket creation, number porting requests, service changes

**Gateway:** Azure API Management (APIM)
**Authentication:** OAuth 2.0 via Microsoft Entra ID — Authorization Code flow with PKCE for the portal (B2C), Client Credentials grant for service-to-service
**Rate Limiting:** 1,000 requests/minute per client for portal APIs; 10,000 requests/minute for service-to-service integrations

See [BSS API Reference](bss-apis.md) for detailed endpoint documentation.

### OSS APIs (Network-Facing)

- **Network Monitoring API** — Alarm retrieval, acknowledgment, and metrics querying
- **Provisioning API** — Subscriber activation, plan changes, SIM management
- **Fault Management API** — Fault retrieval, ticket creation, fault statistics

**Gateway:** None (internal network, not exposed through API Gateway)
**Authentication:** API key (256-bit, rotated quarterly) + IP whitelist (internal network ranges only)
**Rate Limiting:** No formal rate limiting (internal network, trusted clients only)

See [OSS API Reference](oss-apis.md) for detailed endpoint documentation.

### Integration APIs (Third-Party / Partner)

- **Salesforce API Facade** — Wrapped via [CRM Integration Layer](../technical/crm-integration.md)
- **Ericsson OSS API** — SOAP/XML provisioning commands (vendor-managed interface)
- **Huawei NMS API** — Proprietary network management (vendor-managed interface)
- **Roaming Partner APIs** — TAP file exchange and inter-carrier settlement
- **Authentication:** Varies by partner — OAuth 2.0, API key, or certificate-based mutual TLS

## TMForum Open API Alignment

| TMForum API | Standard | Acme Telco Status | Notes |
|-------------|----------|-------------------|-------|
| TMF620 | Product Catalog Management | Partial | Plan catalog API aligned; custom extensions for telco-specific fields (bundle allowances, roaming tiers) |
| TMF641 | Service Order Management | Partial | Provisioning workflows mapped to TMF641 patterns; async callback model differs from specification |
| TMF676 | Payment Management | Aligned | Billing/payment API closely follows TMF676 request/response models |
| TMF632 | Party Management | Planned | Subscriber API to be refactored for TMF632 alignment in upcoming roadmap cycle |
| TMF638 | Service Inventory Management | Not started | Future roadmap item; currently no dedicated service inventory API |

## Authentication and Authorization

### BSS APIs (OAuth 2.0 via Microsoft Entra ID)

**Portal (B2C Subscribers):**
- Flow: Authorization Code with PKCE
- Token endpoint: Entra ID B2C tenant
- Scopes: `subscriber.read`, `subscriber.write`, `billing.read`, `billing.write`, `plan.read`, `plan.write`
- Access token lifetime: 15 minutes; refresh token: 7 days

**Service-to-Service:**
- Flow: Client Credentials grant
- Scopes: Same as above, assigned per client application registration
- Access token lifetime: 1 hour

### OSS APIs

- API key: 256-bit key passed in `X-API-Key` header
- IP whitelist: Only internal management network ranges accepted
- Key rotation: Quarterly, coordinated across consuming teams

### Integration APIs
- Per-partner authentication negotiated in integration agreements
- Certificate-based mutual TLS preferred for high-volume integrations

## API Governance

- **Design Guidelines:** Based on Acme Corp API standards with telco-specific extensions for CDR, subscriber, and network resource entities
- **Specification Format:** OpenAPI 3.0 required for all new BSS APIs. Enforced via CI linting (spectral) in GitHub Actions pipeline.
- **Versioning:** URL-based versioning (`/api/v1/`, `/api/v2/`) with 12-month deprecation policy
- **Breaking Change Process:** RFC proposal -> architecture review -> deprecation notice to consumers -> 6-month migration period -> sunset
- **Documentation:** BSS API docs auto-generated from OpenAPI specs; OSS API docs manually maintained (improvement initiative in progress)
