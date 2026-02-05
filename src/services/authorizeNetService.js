const axios = require('axios');

const SANDBOX_URL = 'https://apitest.authorize.net/xml/v1/request.api';
const PRODUCTION_URL = 'https://api.authorize.net/xml/v1/request.api';

function getApiUrl() {
  return process.env.AUTHNET_SANDBOX === 'true' ? SANDBOX_URL : PRODUCTION_URL;
}

function getAuth() {
  return {
    name: process.env.AUTHNET_API_LOGIN_ID,
    transactionKey: process.env.AUTHNET_TRANSACTION_KEY,
  };
}

async function chargeCreditCard(amount, card, orderNumber) {
  const payment = {
    creditCard: {
      cardNumber: card.cardNumber,
      expirationDate: card.expirationDate,
      cardCode: card.cvv,
    },
  };
  return _processTransaction(amount, payment, orderNumber);
}

async function chargeACH(amount, bank, orderNumber) {
  const payment = {
    bankAccount: {
      accountType: bank.accountType,
      routingNumber: bank.routingNumber,
      accountNumber: bank.accountNumber,
      nameOnAccount: bank.nameOnAccount,
    },
  };
  return _processTransaction(amount, payment, orderNumber);
}

async function _processTransaction(amount, payment, orderNumber) {
  // Mock card numbers for testing (sandbox only)
  if (process.env.AUTHNET_SANDBOX === 'true' && payment.creditCard) {
    const cardNum = payment.creditCard.cardNumber;
    if (cardNum === '4111111111111111') {
      console.log('[MOCK] Approved payment for order:', orderNumber);
      return {
        success: true,
        transactionId: 'MOCK-' + Date.now().toString(36).toUpperCase(),
        authCode: 'MOCK01',
        message: 'Payment approved.',
      };
    }
    if (cardNum === '4000000000000002') {
      console.log('[MOCK] Declined payment for order:', orderNumber);
      return {
        success: false,
        transactionId: null,
        authCode: null,
        message: 'Payment declined. Please check your payment details and try again.',
      };
    }
  }

  const auth = getAuth();
  const requestBody = {
    createTransactionRequest: {
      merchantAuthentication: {
        name: auth.name,
        transactionKey: auth.transactionKey,
      },
      transactionRequest: {
        transactionType: 'authCaptureTransaction',
        amount: amount.toFixed(2),
        payment: payment,
        order: {
          invoiceNumber: orderNumber,
        },
      },
    },
  };

  const res = await axios.post(getApiUrl(), requestBody, {
    headers: { 'Content-Type': 'application/json' },
  });

  return _parseResponse(res.data);
}

// Patterns that indicate configuration/server issues (not user input issues)
const CONFIG_ERROR_PATTERNS = [
  /AnetApiSchema\.xsd/i,           // Schema validation errors
  /transactionKey/i,               // Credential issues
  /merchantAuthentication/i,       // Auth block issues
  /API Login ID/i,                 // Login ID issues
  /Invalid credentials/i,          // Explicit auth failures
];

const FRIENDLY_CONFIG_ERROR = 'Payment service is temporarily unavailable. Please try again later.';

function _isConfigurationError(message) {
  if (!message) return false;
  return CONFIG_ERROR_PATTERNS.some(pattern => pattern.test(message));
}

function _parseResponse(data) {
  const txResponse = data.transactionResponse;

  if (!txResponse) {
    const rawMessage = (data.messages && data.messages.message && data.messages.message[0] && data.messages.message[0].text)
      || 'No response from payment gateway.';

    // Check if this is a configuration/auth error
    if (_isConfigurationError(rawMessage)) {
      console.error('[AuthorizeNet] Configuration error:', rawMessage);
      return {
        success: false,
        transactionId: null,
        authCode: null,
        message: FRIENDLY_CONFIG_ERROR,
      };
    }

    return {
      success: false,
      transactionId: null,
      authCode: null,
      message: rawMessage,
    };
  }

  const responseCode = parseInt(txResponse.responseCode, 10);

  if (responseCode === 1) {
    return {
      success: true,
      transactionId: txResponse.transId,
      authCode: txResponse.authCode,
      message: 'Payment approved.',
    };
  }

  let message = 'Payment was not approved.';
  let rawErrorMessage = null;
  if (txResponse.errors && txResponse.errors.length > 0) {
    rawErrorMessage = txResponse.errors[0].errorText;
    message = rawErrorMessage;
  } else if (txResponse.messages && txResponse.messages.length > 0) {
    rawErrorMessage = txResponse.messages[0].description;
    message = rawErrorMessage;
  }

  // Check if this is a configuration/auth error
  if (_isConfigurationError(rawErrorMessage)) {
    console.error('[AuthorizeNet] Configuration error:', rawErrorMessage);
    return {
      success: false,
      transactionId: txResponse.transId || null,
      authCode: txResponse.authCode || null,
      message: FRIENDLY_CONFIG_ERROR,
    };
  }

  if (responseCode === 2) {
    message = 'Payment declined. Please check your payment details and try again.';
  } else if (responseCode === 4) {
    message = 'Payment is being held for review. Please contact support.';
  }

  return {
    success: false,
    transactionId: txResponse.transId || null,
    authCode: txResponse.authCode || null,
    message: message,
  };
}

module.exports = { chargeCreditCard, chargeACH };
