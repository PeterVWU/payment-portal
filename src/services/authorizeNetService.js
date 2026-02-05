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

function _parseResponse(data) {
  const txResponse = data.transactionResponse;

  if (!txResponse) {
    return {
      success: false,
      transactionId: null,
      authCode: null,
      message: (data.messages && data.messages.message && data.messages.message[0] && data.messages.message[0].text)
        || 'No response from payment gateway.',
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
  if (txResponse.errors && txResponse.errors.length > 0) {
    message = txResponse.errors[0].errorText;
  } else if (txResponse.messages && txResponse.messages.length > 0) {
    message = txResponse.messages[0].description;
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
