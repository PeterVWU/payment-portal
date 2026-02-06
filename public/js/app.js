(function () {
  'use strict';

  // State
  let detectedCardType = null;

  // ============================================
  // Credit Card Formatting & Validation
  // ============================================

  // Detect card type by BIN prefix
  function getCardType(number) {
    var digits = number.replace(/\D/g, '');
    if (!digits) return null;

    // Visa: starts with 4
    if (/^4/.test(digits)) return 'visa';

    // Mastercard: 51-55 or 2221-2720
    if (/^5[1-5]/.test(digits)) return 'mastercard';
    if (/^2[2-7]/.test(digits)) {
      var prefix = parseInt(digits.substring(0, 4), 10);
      if (prefix >= 2221 && prefix <= 2720) return 'mastercard';
    }

    // Amex: 34 or 37
    if (/^3[47]/.test(digits)) return 'amex';

    // Discover: 6011, 622126-622925, 644-649, 65
    if (/^6011/.test(digits)) return 'discover';
    if (/^65/.test(digits)) return 'discover';
    if (/^64[4-9]/.test(digits)) return 'discover';
    if (/^622/.test(digits)) {
      var discPrefix = parseInt(digits.substring(0, 6), 10);
      if (discPrefix >= 622126 && discPrefix <= 622925) return 'discover';
    }

    return null;
  }

  // Format card number with spaces (groups of 4, or 4-6-5 for Amex)
  function formatCardNumber(value, cardType) {
    var digits = value.replace(/\D/g, '');

    if (cardType === 'amex') {
      // Amex: 4-6-5 format (15 digits max)
      digits = digits.substring(0, 15);
      var parts = [];
      if (digits.length > 0) parts.push(digits.substring(0, 4));
      if (digits.length > 4) parts.push(digits.substring(4, 10));
      if (digits.length > 10) parts.push(digits.substring(10, 15));
      return parts.join(' ');
    } else {
      // Others: groups of 4 (16 digits max)
      digits = digits.substring(0, 16);
      return digits.replace(/(.{4})/g, '$1 ').trim();
    }
  }

  // Luhn algorithm validation
  function validateCardNumber(number) {
    var digits = number.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 16) return false;

    var sum = 0;
    var isEven = false;

    for (var i = digits.length - 1; i >= 0; i--) {
      var digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  // Format expiration date with auto-slash
  function formatExpDateInput(value) {
    var digits = value.replace(/\D/g, '');
    if (digits.length >= 2) {
      return digits.substring(0, 2) + '/' + digits.substring(2, 4);
    }
    return digits;
  }

  // Validate expiration date format and check not expired
  function validateExpDate(value) {
    var match = value.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return { valid: false, error: 'Invalid expiration date' };

    var month = parseInt(match[1], 10);
    var year = parseInt('20' + match[2], 10);

    if (month < 1 || month > 12) {
      return { valid: false, error: 'Invalid month (01-12)' };
    }

    var now = new Date();
    var currentYear = now.getFullYear();
    var currentMonth = now.getMonth() + 1;

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { valid: false, error: 'Card has expired' };
    }

    return { valid: true, error: null };
  }

  // Validate CVV based on card type
  function validateCVV(value, cardType) {
    var digits = value.replace(/\D/g, '');
    var expectedLength = cardType === 'amex' ? 4 : 3;

    if (digits.length !== expectedLength) {
      return {
        valid: false,
        error: 'CVV must be ' + expectedLength + ' digits'
      };
    }
    return { valid: true, error: null };
  }

  // Show/hide field error
  function showFieldError(inputEl, errorEl, message) {
    errorEl.textContent = message;
    inputEl.classList.add('input-error');
    inputEl.classList.remove('input-valid');
  }

  function showFieldValid(inputEl, errorEl) {
    errorEl.textContent = '';
    inputEl.classList.remove('input-error');
    inputEl.classList.add('input-valid');
  }

  function clearFieldState(inputEl, errorEl) {
    errorEl.textContent = '';
    inputEl.classList.remove('input-error', 'input-valid');
  }

  // DOM elements
  const stepForm = document.getElementById('step-form');
  const stepSuccess = document.getElementById('step-success');

  const paymentForm = document.getElementById('payment-form');
  const payBtn = document.getElementById('pay-btn');
  const paymentError = document.getElementById('payment-error');

  const newPaymentBtn = document.getElementById('new-payment-btn');

  // Credit card input elements
  const cardNumberInput = document.getElementById('cardNumber');
  const cardNumberError = document.getElementById('cardNumber-error');
  const cardTypeIndicator = document.getElementById('card-type');
  const expDateInput = document.getElementById('expDate');
  const expDateError = document.getElementById('expDate-error');
  const cvvInput = document.getElementById('cvv');
  const cvvError = document.getElementById('cvv-error');

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
  payBtn.dataset.originalText = payBtn.textContent;

  // ============================================
  // Credit Card Input Event Handlers
  // ============================================

  // Card number: format on input, validate on blur
  cardNumberInput.addEventListener('input', function () {
    var cursorPos = this.selectionStart;
    var oldValue = this.value;
    var oldLength = oldValue.length;

    // Detect card type from digits
    detectedCardType = getCardType(this.value);

    // Format the number
    this.value = formatCardNumber(this.value, detectedCardType);

    // Update maxlength based on card type
    this.maxLength = detectedCardType === 'amex' ? 17 : 19;

    // Update CVV maxlength based on card type
    cvvInput.maxLength = detectedCardType === 'amex' ? 4 : 3;
    cvvInput.placeholder = detectedCardType === 'amex' ? '1234' : '123';

    // Update card type indicator
    if (detectedCardType) {
      var typeNames = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'Amex',
        discover: 'Discover'
      };
      cardTypeIndicator.textContent = typeNames[detectedCardType];
      cardTypeIndicator.className = 'card-type ' + detectedCardType;
    } else {
      cardTypeIndicator.textContent = '';
      cardTypeIndicator.className = 'card-type';
    }

    // Adjust cursor position for added spaces
    var newLength = this.value.length;
    var diff = newLength - oldLength;
    if (diff > 0 && cursorPos === oldLength) {
      // Cursor was at end, keep at end
      this.setSelectionRange(newLength, newLength);
    } else {
      // Try to maintain relative cursor position
      var newPos = cursorPos + diff;
      if (newPos < 0) newPos = 0;
      if (newPos > newLength) newPos = newLength;
      this.setSelectionRange(newPos, newPos);
    }

    // Clear error state while typing
    clearFieldState(this, cardNumberError);
  });

  cardNumberInput.addEventListener('blur', function () {
    var digits = this.value.replace(/\D/g, '');
    if (!digits) {
      clearFieldState(this, cardNumberError);
      return;
    }

    if (!validateCardNumber(this.value)) {
      showFieldError(this, cardNumberError, 'Invalid card number');
    } else {
      showFieldValid(this, cardNumberError);
    }
  });

  // Expiration date: auto-insert slash, validate on blur
  expDateInput.addEventListener('input', function () {
    var cursorPos = this.selectionStart;
    var oldValue = this.value;

    // Only allow digits and slash
    var cleaned = this.value.replace(/[^\d\/]/g, '');

    // Format with auto-slash
    this.value = formatExpDateInput(cleaned);

    // Adjust cursor if slash was auto-inserted
    if (oldValue.length === 2 && this.value.length === 3 && cursorPos === 2) {
      this.setSelectionRange(3, 3);
    }

    clearFieldState(this, expDateError);
  });

  expDateInput.addEventListener('blur', function () {
    if (!this.value) {
      clearFieldState(this, expDateError);
      return;
    }

    var result = validateExpDate(this.value);
    if (!result.valid) {
      showFieldError(this, expDateError, result.error);
    } else {
      showFieldValid(this, expDateError);
    }
  });

  // CVV: digits only, validate on blur
  cvvInput.addEventListener('input', function () {
    // Strip non-digits
    this.value = this.value.replace(/\D/g, '');
    clearFieldState(this, cvvError);
  });

  cvvInput.addEventListener('blur', function () {
    if (!this.value) {
      clearFieldState(this, cvvError);
      return;
    }

    var result = validateCVV(this.value, detectedCardType);
    if (!result.valid) {
      showFieldError(this, cvvError, result.error);
    } else {
      showFieldValid(this, cvvError);
    }
  });

  // Reset credit card field states
  function resetCCFieldStates() {
    detectedCardType = null;
    clearFieldState(cardNumberInput, cardNumberError);
    clearFieldState(expDateInput, expDateError);
    clearFieldState(cvvInput, cvvError);
    cardTypeIndicator.textContent = '';
    cardTypeIndicator.className = 'card-type';
    cvvInput.maxLength = 4;
    cvvInput.placeholder = '123';
    cardNumberInput.maxLength = 19;
  }

  // ============================================
  // Form Submission
  // ============================================

  paymentForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideError(paymentError);

    var orderNumber = document.getElementById('orderNumber').value.trim();
    var email = document.getElementById('email').value.trim();
    var cardNumber = cardNumberInput.value.trim();
    var expDate = expDateInput.value.trim();
    var cvv = cvvInput.value.trim();

    // Validate all fields present
    if (!orderNumber || !email || !cardNumber || !expDate || !cvv) {
      showError(paymentError, 'Please fill in all fields.');
      return;
    }

    // Validate CC fields
    var hasErrors = false;

    if (!validateCardNumber(cardNumber)) {
      showFieldError(cardNumberInput, cardNumberError, 'Invalid card number');
      hasErrors = true;
    }

    var expResult = validateExpDate(expDate);
    if (!expResult.valid) {
      showFieldError(expDateInput, expDateError, expResult.error);
      hasErrors = true;
    }

    var cvvResult = validateCVV(cvv, detectedCardType);
    if (!cvvResult.valid) {
      showFieldError(cvvInput, cvvError, cvvResult.error);
      hasErrors = true;
    }

    if (hasErrors) {
      showError(paymentError, 'Please correct the errors above.');
      return;
    }

    setButtonLoading(payBtn, true, 'Processing...');

    fetch('/api/process-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: orderNumber,
        email: email,
        paymentMethod: 'cc',
        paymentDetails: {
          cardNumber: cardNumber.replace(/\s/g, ''),
          expirationDate: formatExpDate(expDate),
          cvv: cvv,
        },
      }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        setButtonLoading(payBtn, false);

        if (!result.ok) {
          showError(paymentError, result.data.error || 'Payment failed.');
          return;
        }

        stepForm.hidden = true;
        stepSuccess.hidden = false;
      })
      .catch(function () {
        setButtonLoading(payBtn, false);
        showError(paymentError, 'An error occurred. Please try again.');
      });
  });

  // New payment button
  newPaymentBtn.addEventListener('click', function () {
    paymentForm.reset();
    resetCCFieldStates();
    hideError(paymentError);
    stepSuccess.hidden = true;
    stepForm.hidden = false;
  });
})();
