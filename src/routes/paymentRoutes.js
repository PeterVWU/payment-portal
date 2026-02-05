const express = require('express');
const router = express.Router();
const magento = require('../services/magentoService');
const authnet = require('../services/authorizeNetService');

router.post('/lookup-order', async (req, res) => {
  try {
    const { orderNumber, email } = req.body;

    if (!orderNumber || !email) {
      return res.status(400).json({ error: 'Order number and email are required.' });
    }

    const order = await magento.lookupOrder(orderNumber);

    if (!order || order.customer_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(404).json({ error: 'Order not found. Please check your order number and email.' });
    }

    const invalidStatuses = ['canceled', 'closed', 'complete'];
    if (invalidStatuses.includes(order.status)) {
      return res.status(400).json({ error: 'This order is not eligible for payment.' });
    }

    const totalDue = parseFloat(order.total_due || 0);
    if (totalDue <= 0) {
      return res.status(400).json({ error: 'This order has no balance due.' });
    }

    const items = (order.items || []).map(item => ({
      name: item.name,
      sku: item.sku,
      qty: item.qty_ordered,
      price: item.price,
      rowTotal: item.row_total,
    }));

    return res.json({
      incrementId: order.increment_id,
      grandTotal: parseFloat(order.grand_total),
      totalDue: totalDue,
      items: items,
    });
  } catch (err) {
    console.error('Order lookup error:', err.message);
    return res.status(500).json({ error: 'Unable to look up order. Please try again.' });
  }
});

router.post('/process-payment', async (req, res) => {
  try {
    const { orderNumber, email, paymentMethod, paymentDetails } = req.body;

    if (!orderNumber || !email || !paymentMethod || !paymentDetails) {
      return res.status(400).json({ error: 'All payment fields are required.' });
    }

    if (!['cc', 'ach'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }

    // Re-verify order
    const order = await magento.lookupOrder(orderNumber);

    if (!order || order.customer_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const totalDue = parseFloat(order.total_due || 0);
    if (totalDue <= 0) {
      return res.status(400).json({ error: 'This order has no balance due.' });
    }

    let paymentResult;
    if (paymentMethod === 'cc') {
      paymentResult = await authnet.chargeCreditCard(totalDue, paymentDetails, orderNumber);
    } else {
      paymentResult = await authnet.chargeACH(totalDue, paymentDetails, orderNumber);
    }

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.message });
    }

    // Create invoice in Magento
    try {
      await magento.createInvoice(order.entity_id, order.items, paymentResult.transactionId);
    } catch (invoiceErr) {
      console.error('CRITICAL: Payment succeeded but invoice creation failed.', {
        orderNumber,
        transactionId: paymentResult.transactionId,
        error: invoiceErr.message,
      });
      try {
        await magento.addOrderComment(
          order.entity_id,
          `CRITICAL: Payment received (Transaction ID: ${paymentResult.transactionId}) but invoice creation failed. Manual invoice required. Error: ${invoiceErr.message}`
        );
      } catch (commentErr) {
        console.error('Failed to add order comment:', commentErr.message);
      }
      // Still return success to customer — they've been charged
      return res.json({
        success: true,
        transactionId: paymentResult.transactionId,
      });
    }

    // Add payment confirmation comment
    try {
      await magento.addOrderComment(
        order.entity_id,
        `Payment received via Payment Portal. Transaction ID: ${paymentResult.transactionId}, Auth Code: ${paymentResult.authCode}`
      );
    } catch (commentErr) {
      console.error('Failed to add payment comment:', commentErr.message);
    }

    return res.json({
      success: true,
      transactionId: paymentResult.transactionId,
    });
  } catch (err) {
    console.error('Payment processing error:', err.message);
    return res.status(500).json({ error: 'Payment processing failed. Please try again.' });
  }
});

module.exports = router;
