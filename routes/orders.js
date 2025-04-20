const express = require('express');
const Order = require('../models/orderModel');
const Service = require('../models/serviceModel');
const Notification = require('../models/notificationModel');
const Tracking = require('../models/trackingModel');
const axios = require("axios");
const router = express.Router();


//Place Order Route
router.post('/', async (req, res) => {
  const { serviceId, userId, quantity } = req.body;

  try {
    if (!serviceId || !userId || !quantity) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }

    const serviceOwnerId = service.serviceOwnerId;
    if (!serviceOwnerId) {
      return res.status(400).json({ message: 'Service owner not found for this service.' });
    }

    const newOrder = new Order({
      serviceId,
      userId,
      serviceOwnerId,
      quantity,
    });

    const savedOrder = await newOrder.save();

    const notification = new Notification({
      serviceOwnerId,
      orderId: savedOrder._id,
      message: `You have a new order for your service: ${service.serviceName}`,
    });

    await notification.save();

    // Populate user details for the placed order
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('userId', 'firstname lastname location phone email') // Populate the user fields
      .populate('serviceId') // Optionally populate service details as well
      .exec();

    res.status(201).json({
      message: 'Order placed successfully',
      order: populatedOrder,  // Return the populated order details
    });
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ message: 'Error placing order', error: error.message });
  }
});


router.get('/notifications/:serviceOwnerId', async (req, res) => {
  try {
    const notifications = await Notification.find({ serviceOwnerId: req.params.serviceOwnerId, isRead: false })
      .populate('orderId')  // Populate order details (including userId and serviceId)
      .populate('orderId.userId', 'firstname lastname location phone email')  // Populate the user information in order
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});


// //Approve or Reject Order
router.patch('/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'

  try {
    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (status === 'Approved') {
      // Create tracking entry when order is approved
      const tracking = new Tracking({
        orderId: order._id,
        status: 'Accepted'
      });
      await tracking.save();
    }

    // const notification = new Notification({
    //   serviceOwnerId: order.serviceOwnerId,
    //   orderId: order._id,
    //   message: `Your order has been ${status.toLowerCase()}.`,
    // });

    // Create notification for customer
    const notification = new Notification({
      serviceOwnerId: order.serviceOwnerId,
      userId: order.userId,
      orderId: order._id,
      message: 'Your order has been approved. Choose a payment method.',
    });
    await notification.save();

    res.status(200).json({ message: `Order ${status.toLowerCase()} successfully`, order });
  } catch (error) {
    console.error('Error updating order status:', error);
  res.status(500).json({ message: 'Error updating order status', error: error.message });
  }
});



// Mark notifications as read
router.patch('/notifications/:notificationId', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.notificationId,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

// Get all orders for a vendor
router.get('/vendor/:serviceOwnerId', async (req, res) => {
  try {
    const orders = await Order.find({ serviceOwnerId: req.params.serviceOwnerId })
      .populate('serviceId', 'serviceName')  // Populate service details
      .populate('userId', 'firstname lastname location phone email')  // Populate user details (username, location, phone, email)
      .sort({ createdAt: -1 });  // Optionally sort by createdAt or any other field

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});


//Update tracking
router.patch('/tracking/:trackingId', async (req, res) => {
  const { trackingId } = req.params;
  const { status } = req.body; // 'In Progress' or 'Completed'

  try {
    const tracking = await Tracking.findOneAndUpdate(
      { trackingId },
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking record not found' });
    }

    res.status(200).json({ message: 'Tracking updated successfully', tracking });
  } catch (error) {
    console.error('Error updating tracking:', error);
    res.status(500).json({ message: 'Error updating tracking' });
  }
});

//Fetch order tracking by order ID
router.get('/tracking/order/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId format' });
    }

    const tracking = await Tracking.findOne({ orderId: mongoose.Types.ObjectId(orderId) })
      .populate('orderId')
      .exec();

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking record not found' });
    }

    res.status(200).json(tracking);
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({ message: 'Error fetching tracking' });
  }
});


//Search tracking  by tracking Id
router.get('/tracking/:trackingId', async (req, res) => {
  try {
    const tracking = await Tracking.findOne({ trackingId: req.params.trackingId });

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking record not found' });
    }

    res.status(200).json(tracking);
  } catch (error) {
    console.error('Error fetching tracking:', error);
    res.status(500).json({ message: 'Error fetching tracking' });
  }
});


// PAYMENT ROUTE:
router.patch('/payment-method/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { method } = req.body; // 'online' or 'offline'

  if (!['online', 'offline'].includes(method)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    order.paymentMethod = method;
    await order.save();

    if (method === 'offline') {
      // mark as paid manually (you can also leave isPaid = false until verified)
      order.isPaid = false;
      await order.save();
      return res.status(200).json({ message: 'Offline payment selected' });
    }

    // Proceed with online payment (Paystack)
    res.status(200).json({ message: 'Proceed to online payment' });

  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.post('/payments/initiate', async (req, res) => {
  const { orderId } = req.body;

  try {
    const order = await Order.findById(orderId).populate('userId');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: order.userId.email,
        amount: Math.floor((order.platformFee + order.vendorReceives) * 100), // Convert to Kobo
        callback_url: `http://localhost:3000/payment-success?orderId=${orderId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      authorization_url: paystackRes.data.data.authorization_url,
      access_code: paystackRes.data.data.access_code,
    });

  } catch (error) {
    console.error('Error initializing Paystack payment:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});


//secure route to handle Paystack webhook events.
router.post("/payments/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto.createHmac("sha512", paystackSecret)
                     .update(req.body)
                     .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(req.body);

  if (event.event === "charge.success") {
    const metadata = event.data.metadata;
    const orderId = metadata.orderId;

    const order = await Order.findById(orderId);
    if (order) {
      const platformFee = +(order.amount * 0.1).toFixed(2);
      const vendorReceives = +(order.amount - platformFee).toFixed(2);

      order.isPaid = true;
      order.status = "paid";
      order.paymentMethod = "online";
      order.platformFee = platformFee;
      order.vendorReceives = vendorReceives;
      await order.save();
    }
  }

  res.sendStatus(200);
});

//verify payment
router.get('/verify-payment/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data;
    if (data.status && data.data.status === 'success') {
      const metadata = data.data.metadata;
      const orderId = metadata?.orderId;

      if (!orderId) {
        return res.status(400).json({ message: 'Order ID not found in metadata' });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      order.isPaid = true;
      order.paymentMethod = 'online';
      await order.save();

      return res.status(200).json({
        message: 'Payment verified successfully',
        orderId: order._id,
        amountPaid: data.data.amount / 100,
      });
    } else {
      return res.status(400).json({ message: 'Payment not successful' });
    }
  } catch (error) {
    console.error('Payment verification failed:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;