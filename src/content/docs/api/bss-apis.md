---
title: "BSS API Reference"
---


# Acme Telco — BSS API Reference

## Introduction

This document provides the API reference for Acme Telco's Business Support System (BSS) APIs. These APIs are exposed through Azure API Management (APIM) and authenticated via OAuth 2.0 (Microsoft Entra ID). All BSS APIs follow OpenAPI 3.0 specifications maintained in the respective service repositories.

For the API landscape overview, see [API Overview](overview.md). For architecture context, see [Architecture Overview](../architecture/overview.md). For the CRM Integration Layer that powers the subscriber data APIs, see [CRM Integration](../technical/crm-integration.md).

## Subscriber API

**Base Path:** `/api/v1/subscribers`
**Authentication:** OAuth 2.0 — scopes: `subscriber.read`, `subscriber.write`

| Method | Path | Description | Auth Scope |
|--------|------|-------------|------------|
| GET | `/subscribers/{msisdn}` | Get subscriber details | subscriber.read |
| POST | `/subscribers` | Create new subscriber | subscriber.write |
| PUT | `/subscribers/{msisdn}` | Update subscriber details | subscriber.write |
| GET | `/subscribers/{msisdn}/usage` | Get current usage summary | subscriber.read |
| GET | `/subscribers/{msisdn}/balance` | Get current balance (prepaid) | subscriber.read |
| GET | `/subscribers/{msisdn}/360` | Get subscriber 360 view | subscriber.read |

### GET /subscribers/{msisdn}

Returns subscriber account details including plan information, account status, and contact details.

**Response Example (200 OK):**
```json
{
  "msisdn": "+14045551234",
  "subscriberId": "SUB-2024-00847392",
  "accountStatus": "active",
  "plan": {
    "planId": "POSTPAID-UNLIMITED-PLUS",
    "planName": "Unlimited Plus",
    "monthlyFee": 75.00,
    "dataAllowance": "unlimited",
    "voiceAllowance": "unlimited",
    "smsAllowance": "unlimited"
  },
  "segment": "consumer",
  "activationDate": "2022-03-15",
  "contractEndDate": "2025-03-14",
  "billingAddress": {
    "street": "123 Peachtree St NW",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30303"
  },
  "autoPayEnabled": true,
  "lastUpdated": "2025-01-15T14:30:00Z"
}
```

### GET /subscribers/{msisdn}/usage

Returns current billing cycle usage summary showing consumption against plan allowances.

**Response Example (200 OK):**
```json
{
  "msisdn": "+14045551234",
  "billingCycleStart": "2025-01-01",
  "billingCycleEnd": "2025-01-31",
  "usage": {
    "data": {
      "consumedMb": 28430,
      "allowanceMb": -1,
      "percentUsed": null,
      "note": "Unlimited plan — deprioritization threshold at 50GB"
    },
    "voice": {
      "consumedMinutes": 342,
      "allowanceMinutes": -1,
      "percentUsed": null
    },
    "sms": {
      "consumedCount": 156,
      "allowanceCount": -1,
      "percentUsed": null
    }
  },
  "lastUpdated": "2025-01-18T10:45:00Z",
  "dataFreshness": "live"
}
```

### GET /subscribers/{msisdn}/balance

Returns current prepaid balance including monetary balance and remaining bundle allowances.

**Response Example (200 OK):**
```json
{
  "msisdn": "+14045559876",
  "balanceType": "prepaid",
  "monetaryBalance": {
    "amount": 23.45,
    "currency": "USD"
  },
  "bundleRemaining": {
    "dataMb": 3200,
    "voiceMinutes": 180,
    "smsCount": 450
  },
  "lastReloadDate": "2025-01-10T09:00:00Z",
  "lastReloadAmount": 30.00,
  "balanceExpiryDate": "2025-02-10",
  "lastUpdated": "2025-01-18T10:47:00Z"
}
```

## Billing API

**Base Path:** `/api/v1/billing`
**Authentication:** OAuth 2.0 — scopes: `billing.read`, `billing.write`

| Method | Path | Description | Auth Scope |
|--------|------|-------------|------------|
| GET | `/billing/{msisdn}/invoices` | List invoices (paginated) | billing.read |
| GET | `/billing/{msisdn}/invoices/{id}` | Get invoice detail | billing.read |
| GET | `/billing/{msisdn}/invoices/{id}/pdf` | Download invoice PDF | billing.read |
| POST | `/billing/{msisdn}/payments` | Submit payment | billing.write |
| GET | `/billing/{msisdn}/payment-history` | Get payment history | billing.read |

### GET /billing/{msisdn}/invoices

Returns paginated list of invoices for the subscriber.

**Query Parameters:** `page` (default: 1), `pageSize` (default: 10, max: 50), `status` (optional: all, paid, unpaid, overdue)

**Response Example (200 OK):**
```json
{
  "msisdn": "+14045551234",
  "invoices": [
    {
      "invoiceId": "INV-2025-01-847392",
      "billingPeriod": "2025-01-01 to 2025-01-31",
      "totalAmount": 82.47,
      "taxAmount": 7.47,
      "status": "delivered",
      "dueDate": "2025-02-15",
      "pdfAvailable": true
    },
    {
      "invoiceId": "INV-2024-12-847392",
      "billingPeriod": "2024-12-01 to 2024-12-31",
      "totalAmount": 79.23,
      "taxAmount": 7.23,
      "status": "paid",
      "dueDate": "2025-01-15",
      "paymentDate": "2025-01-10",
      "pdfAvailable": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalPages": 24,
    "totalItems": 238
  }
}
```

### POST /billing/{msisdn}/payments

Initiates a payment for a specific invoice. Redirects to the third-party payment processor for card data handling (PCI-DSS scope reduction).

**Request Example:**
```json
{
  "invoiceId": "INV-2025-01-847392",
  "amount": 82.47,
  "paymentMethod": "credit_card",
  "returnUrl": "https://portal.acmetelco.com/billing/payment-complete"
}
```

**Response Example (202 Accepted):**
```json
{
  "paymentRequestId": "PAY-2025-01-18-00042",
  "status": "pending",
  "processorRedirectUrl": "https://payments.processor.com/checkout/session/abc123",
  "expiresAt": "2025-01-18T11:15:00Z"
}
```

## Plan Management API

**Base Path:** `/api/v1/plans`
**Authentication:** OAuth 2.0 — scopes: `plan.read`, `plan.write`

| Method | Path | Description | Auth Scope |
|--------|------|-------------|------------|
| GET | `/plans` | List available plans | plan.read |
| GET | `/plans/{id}` | Get plan details | plan.read |
| POST | `/plans/change` | Request plan change | plan.write |
| GET | `/plans/change/{id}/status` | Check plan change status | plan.read |
| GET | `/plans/addons` | List available add-ons | plan.read |
| POST | `/plans/addons` | Add or remove add-on | plan.write |

### GET /plans

Returns available plans with pricing and allowance details. Filterable by plan type.

**Query Parameters:** `type` (optional: prepaid, postpaid, family, business), `page`, `pageSize`

**Response Example (200 OK):**
```json
{
  "plans": [
    {
      "planId": "POSTPAID-UNLIMITED-PLUS",
      "planName": "Unlimited Plus",
      "planType": "postpaid",
      "monthlyFee": 75.00,
      "dataAllowance": "unlimited",
      "deprioritizationThresholdGb": 50,
      "voiceAllowance": "unlimited",
      "smsAllowance": "unlimited",
      "hotspotIncludedGb": 15,
      "internationalCallingIncluded": false,
      "eligibleForDeviceFinancing": true
    },
    {
      "planId": "POSTPAID-BASIC-10GB",
      "planName": "Basic 10GB",
      "planType": "postpaid",
      "monthlyFee": 45.00,
      "dataAllowanceGb": 10,
      "overagePerGb": 10.00,
      "voiceAllowance": "unlimited",
      "smsAllowance": "unlimited",
      "hotspotIncludedGb": 0,
      "internationalCallingIncluded": false,
      "eligibleForDeviceFinancing": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalPages": 3,
    "totalItems": 22
  }
}
```

### POST /plans/change

Submits a plan change request. The change can be effective immediately (prorated) or at the next billing cycle start.

**Request Example:**
```json
{
  "msisdn": "+14045551234",
  "targetPlanId": "POSTPAID-UNLIMITED-PLUS",
  "effectiveDate": "next_cycle",
  "reason": "subscriber_request"
}
```

**Response Example (201 Created):**
```json
{
  "changeRequestId": "CHG-2025-01-18-00815",
  "msisdn": "+14045551234",
  "currentPlan": "POSTPAID-BASIC-10GB",
  "targetPlan": "POSTPAID-UNLIMITED-PLUS",
  "effectiveDate": "2025-02-01",
  "status": "pending",
  "estimatedMonthlyCostChange": "+$30.00",
  "createdAt": "2025-01-18T11:00:00Z"
}
```

## Self-Service API

**Base Path:** `/api/v1/self-service`
**Authentication:** OAuth 2.0 — scopes: `subscriber.read`, `subscriber.write`

| Method | Path | Description | Auth Scope |
|--------|------|-------------|------------|
| POST | `/self-service/support-tickets` | Create support ticket | subscriber.write |
| GET | `/self-service/support-tickets` | List subscriber's tickets | subscriber.read |
| GET | `/self-service/support-tickets/{id}` | Get ticket details | subscriber.read |
| POST | `/self-service/number-port` | Request number port-in | subscriber.write |
| GET | `/self-service/number-port/{id}` | Check port request status | subscriber.read |

### POST /self-service/support-tickets

Creates a support ticket routed to Salesforce Service Cloud for resolution.

**Request Example:**
```json
{
  "msisdn": "+14045551234",
  "category": "billing_dispute",
  "priority": "medium",
  "description": "Charged for international call to Canada on January 12 but I have the International Calling add-on which should cover Canada.",
  "relatedInvoiceId": "INV-2025-01-847392"
}
```

**Response Example (201 Created):**
```json
{
  "ticketId": "TKT-2025-01-18-04521",
  "status": "open",
  "category": "billing_dispute",
  "priority": "medium",
  "estimatedResponseTime": "24 hours",
  "createdAt": "2025-01-18T11:10:00Z"
}
```

### POST /self-service/number-port

Submits a number port-in request from another carrier.

**Request Example:**
```json
{
  "portingNumber": "+14045559999",
  "currentCarrier": "National Carrier A",
  "accountNumber": "ACC-9876543",
  "accountPin": "1234",
  "authorizedName": "Jane Smith",
  "targetPlanId": "POSTPAID-UNLIMITED-PLUS"
}
```

**Response Example (201 Created):**
```json
{
  "portRequestId": "PORT-2025-01-18-00312",
  "portingNumber": "+14045559999",
  "status": "submitted",
  "estimatedCompletionDate": "2025-01-21",
  "steps": [
    {"step": "submitted", "status": "complete", "timestamp": "2025-01-18T11:15:00Z"},
    {"step": "validation", "status": "pending"},
    {"step": "scheduled", "status": "pending"},
    {"step": "executed", "status": "pending"},
    {"step": "confirmed", "status": "pending"}
  ],
  "createdAt": "2025-01-18T11:15:00Z"
}
```

## Error Handling

All BSS APIs use a consistent error response format:

```json
{
  "error": {
    "code": "SUBSCRIBER_NOT_FOUND",
    "message": "No subscriber found with MSISDN +14045551234",
    "details": [],
    "traceId": "abc123-def456-ghi789"
  }
}
```

### HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| 400 | Bad Request | Validation error — missing required field, invalid format |
| 401 | Unauthorized | Missing or invalid OAuth 2.0 access token |
| 403 | Forbidden | Valid token but insufficient scope or unauthorized for resource |
| 404 | Not Found | Subscriber, invoice, plan, or ticket not found |
| 409 | Conflict | Conflicting operation — e.g., plan change already pending |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server-side error |

### Rate Limit Headers

All API responses include rate limit headers:
- `X-RateLimit-Limit` — Maximum requests per window
- `X-RateLimit-Remaining` — Remaining requests in current window
- `X-RateLimit-Reset` — Unix timestamp when the rate limit window resets

When rate limited (429), the response body includes a `retryAfter` field in seconds.

### Common Error Codes

| Code | Description |
|------|-------------|
| `SUBSCRIBER_NOT_FOUND` | No subscriber matches the provided MSISDN |
| `INVOICE_NOT_FOUND` | Invoice ID does not exist or does not belong to the subscriber |
| `PLAN_NOT_AVAILABLE` | Requested plan is not available for the subscriber's segment or region |
| `PLAN_CHANGE_PENDING` | A plan change is already in progress for this subscriber |
| `PORT_VALIDATION_FAILED` | Number porting authorization could not be validated |
| `INSUFFICIENT_BALANCE` | Prepaid balance insufficient for the requested operation |
| `PAYMENT_PROCESSING_ERROR` | Payment processor returned an error |
