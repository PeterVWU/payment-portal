Project overview
A standalone "Satellite" Node.js application (pay.vwu.com) that allows wholesale customers to pay for existing Magento 2 orders using a simple, self-service interface.

Goal: Allow customers to pay open invoices via Credit Card or ACH without logging into Magento.

Core Logic: Validates the order against the Magento API, processes payment via Authorize.net, and then updates the Magento order status to "Paid" (Processing).

Security: Keeps Magento Admin API keys hidden server-side; does not touch Magento core PHP files.


1. The Sales Process (Internal)
Create Order: The Sales Rep creates a wholesale order in Magento as usual.

Select Payment Method: Instead of asking for a card over the phone, they select a new option called "Wholesale Invoice (Pay Later)."

Result: The order is created immediately with a status of Pending.

Action: The Sales Rep copies the standard link (pay.vwu.com) and emails it to the customer.

2. The Customer Experience (External)
Access: The customer clicks the link and lands on your branded payment page.

Login: They type in their Order Number and Email Address to verify their identity.

Review: The system shows them the "Total Due" for that specific order.

Pay: They enter their Credit Card or Bank Account (ACH) details and click "Pay Now."

3. The Automation (System Logic)
Payment Processing: The app charges the customer via Authorize.net.

Auto-Update: If the payment is successful, the app automatically talks to Magento to:

Create the Invoice.

Mark the Order as "Paid."

Change the status from "Pending" to "Processing."

Completion: The Warehouse team sees the order verify to "Processing" and ships the goods.