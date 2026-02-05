const axios = require('axios');

const client = axios.create({
  baseURL: process.env.MAGENTO_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.MAGENTO_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function lookupOrder(orderNumber) {
  const res = await client.get('/V1/orders', {
    params: {
      'searchCriteria[filterGroups][0][filters][0][field]': 'increment_id',
      'searchCriteria[filterGroups][0][filters][0][value]': orderNumber,
      'searchCriteria[filterGroups][0][filters][0][conditionType]': 'eq',
    },
  });

  const orders = res.data.items;
  if (!orders || orders.length === 0) {
    return null;
  }
  return orders[0];
}

async function createInvoice(orderId, items, transactionId) {
  const invoiceItems = items.map(item => ({
    order_item_id: item.item_id,
    qty: item.qty_ordered - (item.qty_invoiced || 0),
  })).filter(item => item.qty > 0);

  const res = await client.post(`/V1/order/${orderId}/invoice`, {
    capture: true,
    items: invoiceItems,
    comment: {
      comment: `Payment received via Payment Portal. Authorize.net Transaction ID: ${transactionId}`,
      is_visible_on_front: 0,
    },
  });

  return res.data;
}

async function addOrderComment(orderId, comment) {
  await client.post(`/V1/orders/${orderId}/comments`, {
    statusHistory: {
      comment: comment,
      is_visible_on_front: 0,
    },
  });
}

module.exports = { lookupOrder, createInvoice, addOrderComment };
