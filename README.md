# Payment Portal

A standalone Node.js payment portal that allows wholesale customers to pay for existing Magento 2 orders via Credit Card or ACH without logging into Magento.

## How It Works

1. Customer enters their order number and email address
2. The system validates the order against the Magento 2 REST API
3. Customer pays via Credit Card or ACH through Authorize.net
4. The system creates an invoice in Magento and updates the order status

## Prerequisites

- Node.js (v18+)
- A Magento 2 store with REST API access
- An Authorize.net merchant account

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with the following values:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `3000` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `MAGENTO_BASE_URL` | Magento 2 REST API base URL (e.g. `https://your-store.com/rest/default`) | *required* |
| `MAGENTO_ACCESS_TOKEN` | Magento 2 integration access token | *required* |
| `AUTHNET_API_LOGIN_ID` | Authorize.net API Login ID | *required* |
| `AUTHNET_TRANSACTION_KEY` | Authorize.net Transaction Key | *required* |
| `AUTHNET_SANDBOX` | Set to `true` to use Authorize.net sandbox environment | `true` |

#### Magento access token

Create an Integration in your Magento admin (**System > Integrations**) with access to:
- Sales (orders, invoices)

Copy the Access Token into `MAGENTO_ACCESS_TOKEN`.

#### Authorize.net credentials

Get your API Login ID and Transaction Key from the Authorize.net Merchant Interface under **Account > Settings > Security Settings > General Security Settings > API Credentials & Keys**.

For testing, create a sandbox account at [developer.authorize.net](https://developer.authorize.net/).

### 3. Start the server

```bash
# Production
npm start

# Development (auto-reload with nodemon)
npm run dev
```

The portal will be available at `http://localhost:3000`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/lookup-order` | Validate order number + email, returns order details |
| `POST` | `/api/process-payment` | Process payment and create Magento invoice |
| `GET` | `/health` | Health check |

## Testing with Mock Cards

When `AUTHNET_SANDBOX=true`, you can use these mock credit card numbers to test without hitting the Authorize.net API:

| Card Number | Behavior |
|-------------|----------|
| `4111 1111 1111 1111` | Approved -- returns a success response |
| `4000 0000 0000 0002` | Declined -- returns a decline error |

Use any future expiration date and any 3-digit CVV. The server logs will show `[MOCK] Approved...` or `[MOCK] Declined...` for these transactions.

Any other card number will be sent to the Authorize.net sandbox API as normal.

## Project Structure

```
src/
  index.js                        # Express app setup (helmet, rate limiting, static files)
  routes/paymentRoutes.js         # API endpoints for order lookup and payment processing
  services/
    magentoService.js             # Magento 2 REST API client (order lookup, invoice creation)
    authorizeNetService.js        # Authorize.net payment processing (CC and ACH)
public/
  index.html                      # Single-page UI with 3-step flow
  js/app.js                       # Client-side form handling and validation
  css/styles.css                  # Styles
```

## Security

- [Helmet](https://helmetjs.github.io/) middleware with strict Content Security Policy
- Rate limiting: 30 requests per 15 minutes on `/api` routes
- Magento admin credentials are kept server-side only
- Configuration errors (invalid API keys, schema issues) are masked from users with a generic message
