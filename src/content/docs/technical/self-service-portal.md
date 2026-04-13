---
title: "Self-Service Portal"
draft: false
---


# Acme Telco — Self-Service Portal

## System Overview

The Self-Service Portal is Acme Telco's customer-facing web application, enabling subscribers to manage their accounts, view usage, pay bills, and request service changes without contacting customer support. It directly impacts customer satisfaction metrics and call center deflection rates.

- **Frontend:** Angular 16 Single Page Application (SPA)
- **Backend-for-Frontend (BFF):** Java 17 / Spring Boot 3 on AKS
- **Database:** PostgreSQL 15 (session management, portal configuration, user preferences)
- **Team:** Portal Engineering (15 engineers)
- **Traffic:** ~65% of sessions originate from mobile devices

For system context, see [System Landscape](system-landscape.md). For architecture context, see [Architecture Overview](../architecture/overview.md). The portal depends on the [CRM Integration Layer](crm-integration.md) for subscriber data and the [Rating Engine](rating-engine.md) for balance and usage information.

## Feature Set

### Account Management

- **Account Overview:** Plan details, account status, billing address, payment method on file, contract terms and renewal date
- **Profile Editing:** Contact information, communication preferences (email, SMS, postal), authorized users who can manage the account
- **Account Security:** Password change, multi-factor authentication (MFA) enrollment and management, active session listing and forced logout
- **Device Management:** Linked devices with IMEI/IMSI tracking, device upgrade eligibility check, device protection plan enrollment

### Usage Dashboard

- **Real-Time Usage Display:** Current billing cycle data consumption, voice minutes used, SMS sent — all shown against plan allowances with visual progress indicators
- **Usage History:** Daily, weekly, and monthly breakdowns with interactive charts. Historical data available for the last 12 billing cycles.
- **Usage Alerts:** Configurable threshold-based notifications (e.g., "notify me at 80% data usage"). Alerts delivered via push notification and/or SMS.
- **Roaming Usage:** Separate tracking for roaming consumption with real-time cost estimates based on per-country roaming rates

Data is sourced from the Rating Engine via the BFF -> CRM Integration -> Rating Engine gRPC call chain. Usage data reflects consumption within the last 60 minutes (see [Billing Mediation](billing-mediation.md) processing windows).

### Billing and Payment

- **Bill Viewing:** Current and historical invoices (last 24 months) with line-item detail. PDF download available for all invoices.
- **Payment Processing:** Credit card, ACH/bank transfer, Apple Pay, and Google Pay accepted. Payment processing is delegated to a third-party payment processor — the portal redirects to the processor's hosted payment page, keeping PCI-DSS scope limited to SAQ A (no card data stored, processed, or transmitted by Acme Telco systems).
- **Auto-Pay:** Enrollment and management of automatic monthly payments with configurable payment date.
- **Payment History:** Complete payment history with transaction details and processor confirmation references.
- **Billing Disputes:** Online dispute submission with category selection, description, and supporting documentation upload. Disputes are routed to Salesforce Service Cloud for resolution.

### Plan Management

- **Plan Browser:** Available plans with side-by-side comparison tool showing pricing, data/voice/SMS allowances, and features
- **Plan Change Request:** Subscribers can request plan changes with effective date selection — immediate (prorated) or next billing cycle start
- **Add-On Management:** Browse, add, and remove add-ons (international calling packages, data boosts, device insurance, premium content subscriptions)
- **Plan Change Impact Preview:** Estimated monthly cost comparison showing current plan vs. target plan, including prorated charges for mid-cycle changes

### Service Requests

- **SIM Replacement:** Request physical SIM replacement (lost, stolen, damaged) with delivery to registered address
- **eSIM Activation:** Provision eSIM profiles with QR code generation for supported devices
- **Number Porting:** Submit port-in requests from other carriers with authorization details. Status tracking through the porting process (submitted, validated, scheduled, completed).
- **International Roaming:** Activate or deactivate international roaming on the account. Purchase roaming data passes for specific countries or regions.
- **Support Tickets:** Create support tickets categorized by issue type, routed to Salesforce Service Cloud. Real-time ticket status tracking and communication thread.

## BFF Pattern

The Java Backend-for-Frontend (BFF) layer serves as the sole API gateway for the Angular SPA. No backend API is directly accessible from the browser — all requests are proxied through the BFF.

**API Aggregation:** A single BFF endpoint may fan out to multiple backend APIs. For example, the dashboard endpoint aggregates data from the CRM Integration Layer (account details), Rating Engine (usage and balance), and Billing Mediation (invoice summary) into a single optimized response.

**Response Shaping:** Backend API responses are transformed into UI-optimized Data Transfer Objects (DTOs). This includes field renaming for frontend conventions, nested data flattening, unit formatting (bytes to GB, seconds to minutes), and localization of currency and date formats.

**Security Boundary:** The BFF handles authentication token management (token refresh, session validation), request validation (input sanitization, rate limiting), and error normalization (backend errors mapped to user-friendly messages with consistent error codes).

**Caching:** The BFF maintains a short-lived cache (1–5 minutes TTL depending on data type) to reduce backend API load during high-traffic periods. Cache invalidation is event-driven for critical data (e.g., payment confirmation immediately invalidates billing cache).

## Authentication and Authorization

**B2C Subscribers:** Microsoft Entra ID B2C provides authentication with configurable identity providers:
- Email/password (primary)
- Social login: Google, Apple ID via Entra ID B2C custom policies
- Salesforce identity provider federation for subscribers who already have Salesforce Community credentials

**Multi-Factor Authentication:** Optional but encouraged. TOTP-based via authenticator apps (Google Authenticator, Microsoft Authenticator). MFA enrollment rate: approximately 35% of active portal users.

**Session Management:**
- JWT access tokens with 15-minute expiry
- Refresh tokens with 7-day expiry
- Tokens stored in HttpOnly secure cookies (not accessible via JavaScript)
- Concurrent session limit: 3 active sessions per subscriber
- Forced logout capability for suspicious activity

**Authorization:** Role-based access control enforced at the BFF layer:
- **Account Owner:** Full access to all account features
- **Authorized User:** View-only access to usage and billing; cannot change plans or make payments unless explicitly granted by account owner

## Performance and SLAs

| Metric | SLO | Current Performance |
|--------|-----|-------------------|
| SPA Initial Load | < 3 seconds | 2.1s (p95) |
| Subsequent Navigation | < 1 second | 0.4s (p95) |
| API Response Time | < 1 second (p95) | 0.6s (p95) |
| Monthly Uptime | 99.9% | 99.95% (trailing 12 months) |

**SPA Delivery:** Static assets (JavaScript bundles, CSS, images) served via Azure CDN with aggressive caching headers. Content hashing ensures cache invalidation on deployment. Gzip and Brotli compression enabled.

**Performance Monitoring:** Azure Application Insights for Real User Monitoring (RUM) captures page load times, API latency, and JavaScript errors from actual user sessions. Lighthouse CI runs in the GitHub Actions pipeline to catch performance regressions before deployment.

## Accessibility

WCAG 2.1 AA compliance is required — the FCC mandates accessibility for telecommunications services under Section 255 and Section 508.

- **Automated Testing:** axe-core accessibility scanner runs in the CI pipeline on every PR. Violations block merge.
- **Manual Audits:** Quarterly accessibility audit by a certified accessibility specialist covering screen reader testing, keyboard navigation, and cognitive accessibility.
- **Screen Reader Support:** ARIA landmarks, live regions for dynamic content updates (usage counters, payment confirmations), and descriptive labels for all interactive elements.
- **Keyboard Navigation:** Full portal functionality accessible without a mouse. Focus management implemented for modal dialogs and page transitions.
- **Color Contrast:** Meets WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text). High-contrast mode available via user preference toggle.

## Mobile Responsiveness

The portal follows a mobile-first responsive design approach:

- **Breakpoints:** 320px (mobile), 768px (tablet), 1024px (small desktop), 1440px (large desktop)
- **No Native App:** A responsive web application serves all form factors. No native iOS or Android app is currently available.
- **PWA Features:** The portal is installable as a Progressive Web App. Offline capability for cached account data (last-viewed plan details, recent invoices). Push notifications for usage alerts and billing reminders.
- **Mobile Traffic:** Approximately 65% of portal sessions originate from mobile devices, validating the mobile-first design approach.

Note: The BFF API documentation is maintained in OpenAPI format in the portal repository but may lag behind implementation by 1–2 sprints. The API surface described in the [BSS APIs](../api/bss-apis.md) document reflects the public-facing contract.
