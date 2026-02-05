# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A standalone Node.js payment portal (pay.vwu.com) that allows wholesale customers to pay for existing Magento 2 orders via Credit Card or ACH without logging into Magento.

**Flow:** Customer enters order number + email → System validates against Magento API → Customer pays via Authorize.net → System creates invoice in Magento and updates order status.

## Commands

```bash
npm start          # Production server
npm run dev        # Development with nodemon auto-reload
```

Server runs on `http://localhost:3000` (configurable via PORT env var).

## Architecture

```
src/
  index.js                      # Express app setup (helmet, rate limiting, static files)
  routes/paymentRoutes.js       # API endpoints: POST /api/lookup-order, POST /api/process-payment
  services/
    magentoService.js           # Magento 2 REST API client (order lookup, invoice creation)
    authorizeNetService.js      # Authorize.net payment processing (CC and ACH)
public/
  index.html                    # Single-page UI with 3-step flow
  js/app.js                     # Client-side form handling and validation
  css/styles.css
```

## API Endpoints

- `POST /api/lookup-order` - Validates order number + email against Magento, returns order details
- `POST /api/process-payment` - Processes payment via Authorize.net, creates Magento invoice
- `GET /health` - Health check

## External Services

**Magento 2 REST API** - Order lookup, invoice creation, order comments. Uses Bearer token auth.

**Authorize.net** - Payment processing. Supports sandbox (apitest.authorize.net) and production (api.authorize.net) modes.

## Environment Variables

Copy `.env.example` to `.env`. Required:
- `MAGENTO_BASE_URL`, `MAGENTO_ACCESS_TOKEN` - Magento API credentials
- `AUTHNET_API_LOGIN_ID`, `AUTHNET_TRANSACTION_KEY` - Authorize.net credentials
- `AUTHNET_SANDBOX` - Set to `true` for sandbox mode

## Error Handling

The authorizeNetService maps technical API errors (schema validation, credential issues) to user-friendly messages while logging originals server-side. Configuration errors return: "Payment service is temporarily unavailable. Please try again later."

## Security

- Helmet middleware with strict CSP
- Rate limiting: 30 requests per 15 minutes on /api routes
- Magento admin credentials kept server-side only
