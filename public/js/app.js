(function () {
  'use strict';

  // State
  let currentOrder = null;
  let currentPaymentMethod = 'cc';

  // DOM elements
  const stepLookup = document.getElementById('step-lookup');
  const stepPay = document.getElementById('step-pay');
  const stepSuccess = document.getElementById('step-success');

  const lookupForm = document.getElementById('lookup-form');
  const lookupBtn = document.getElementById('lookup-btn');
  const lookupError = document.getElementById('lookup-error');

  const orderItems = document.getElementById('order-items');
  const totalDue = document.getElementById('total-due');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const ccFields = document.getElementById('cc-fields');
  const achFields = document.getElementById('ach-fields');

  const paymentForm = document.getElementById('payment-form');
  const payBtn = document.getElementById('pay-btn');
  const paymentError = document.getElementById('payment-error');

  const txnId = document.getElementById('txn-id');
  const backBtn = document.getElementById('back-btn');
  const newLookupBtn = document.getElementById('new-lookup-btn');

  // Utility: escape HTML to prevent XSS
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Utility: format MM/YY to YYYY-MM for Authorize.net
  function formatExpDate(mmyy) {
    var parts = mmyy.split('/');
    if (parts.length !== 2) return mmyy;
    var month = parts[0].trim();
    var year = parts[1].trim();
    if (year.length === 2) year = '20' + year;
    return year + '-' + month;
  }

  function showStep(step) {
    stepLookup.hidden = step !== 'lookup';
    stepPay.hidden = step !== 'pay';
    stepSuccess.hidden = step !== 'success';
  }

  function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function hideError(el) {
    el.textContent = '';
    el.hidden = true;
  }

  function setButtonLoading(btn, loading, loadingText) {
    btn.disabled = loading;
    btn.textContent = loading ? loadingText : btn.dataset.originalText;
  }

  // Save original button text
  lookupBtn.dataset.originalText = lookupBtn.textContent;
  payBtn.dataset.originalText = payBtn.textContent;

  // Tab switching
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentPaymentMethod = btn.dataset.method;

      ccFields.hidden = currentPaymentMethod !== 'cc';
      achFields.hidden = currentPaymentMethod !== 'ach';
      hideError(paymentError);
    });
  });

  // Order lookup
  lookupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError(lookupError);

    var orderNumber = document.getElementById('orderNumber').value.trim();
    var email = document.getElementById('email').value.trim();

    if (!orderNumber || !email) {
      showError(lookupError, 'Please enter both order number and email.');
      return;
    }

    setButtonLoading(lookupBtn, true, 'Looking up...');

    fetch('/api/lookup-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: orderNumber, email: email }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        setButtonLoading(lookupBtn, false);

        if (!result.ok) {
          showError(lookupError, result.data.error || 'Order not found.');
          return;
        }

        currentOrder = result.data;
        renderOrderSummary(currentOrder);
        showStep('pay');
      })
      .catch(function () {
        setButtonLoading(lookupBtn, false);
        showError(lookupError, 'An error occurred. Please try again.');
      });
  });

  function renderOrderSummary(order) {
    orderItems.innerHTML = '';

    order.items.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</td>' +
        '<td title="' + escapeHtml(item.sku) + '">' + escapeHtml(item.sku) + '</td>' +
        '<td>' + escapeHtml(String(item.qty)) + '</td>' +
        '<td>$' + escapeHtml(Number(item.price).toFixed(2)) + '</td>' +
        '<td>$' + escapeHtml(Number(item.rowTotal).toFixed(2)) + '</td>';
      orderItems.appendChild(tr);
    });

    totalDue.innerHTML = '<strong>$' + escapeHtml(Number(order.totalDue).toFixed(2)) + '</strong>';
  }

  // Payment submission
  paymentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError(paymentError);

    if (!currentOrder) {
      showError(paymentError, 'No order loaded. Please go back and look up your order.');
      return;
    }

    var paymentDetails;

    if (currentPaymentMethod === 'cc') {
      var cardNumber = document.getElementById('cardNumber').value.trim();
      var expDate = document.getElementById('expDate').value.trim();
      var cvv = document.getElementById('cvv').value.trim();

      if (!cardNumber || !expDate || !cvv) {
        showError(paymentError, 'Please fill in all credit card fields.');
        return;
      }

      paymentDetails = {
        cardNumber: cardNumber,
        expirationDate: formatExpDate(expDate),
        cvv: cvv,
      };
    } else {
      var nameOnAccount = document.getElementById('nameOnAccount').value.trim();
      var routingNumber = document.getElementById('routingNumber').value.trim();
      var accountNumber = document.getElementById('accountNumber').value.trim();
      var accountType = document.getElementById('accountType').value;

      if (!nameOnAccount || !routingNumber || !accountNumber) {
        showError(paymentError, 'Please fill in all bank account fields.');
        return;
      }

      paymentDetails = {
        nameOnAccount: nameOnAccount,
        routingNumber: routingNumber,
        accountNumber: accountNumber,
        accountType: accountType,
      };
    }

    setButtonLoading(payBtn, true, 'Processing...');

    var orderNumber = document.getElementById('orderNumber').value.trim();
    var email = document.getElementById('email').value.trim();

    fetch('/api/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: orderNumber,
        email: email,
        paymentMethod: currentPaymentMethod,
        paymentDetails: paymentDetails,
      }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        setButtonLoading(payBtn, false);

        if (!result.ok) {
          showError(paymentError, result.data.error || 'Payment failed.');
          return;
        }

        txnId.textContent = result.data.transactionId;
        showStep('success');
      })
      .catch(function () {
        setButtonLoading(payBtn, false);
        showError(paymentError, 'An error occurred. Please try again.');
      });
  });

  // Navigation
  backBtn.addEventListener('click', function () {
    currentOrder = null;
    hideError(paymentError);
    paymentForm.reset();
    showStep('lookup');
  });

  newLookupBtn.addEventListener('click', function () {
    currentOrder = null;
    lookupForm.reset();
    paymentForm.reset();
    hideError(lookupError);
    hideError(paymentError);
    showStep('lookup');
  });
})();
