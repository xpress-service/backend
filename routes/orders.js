const express = require('express');
const Order = require('../models/orderModel');
const User = require('../models/userModel')
const Profile = require('../models/profileModel')
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
console.log('Creating notification for:', serviceOwnerId);
    const notification = new Notification({
      serviceOwnerId,
      orderId: savedOrder._id,
      message: `You have a new order for your service: ${service.serviceName}`,
    });

    await notification.save();
    console.log('Saved notification:', notification);

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
        status: 'Accepted',
      });
      await tracking.save();
    }

    // Notify the user who placed the order
    const userNotification = new Notification({
      userId: order.userId, // the customer
      orderId: order._id,
      message:
        status === 'Approved'
          ? 'Your order has been approved. Please choose a payment method.'
          : 'Your order has been rejected.',
    });
    await userNotification.save();

    res.status(200).json({
      message: `Order ${status.toLowerCase()} successfully`,
      order,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      message: 'Error updating order status',
      error: error.message,
    });
  }
});

// GET /orders/notifications/user/:userId
router.get('/notifications/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const notifications = await Notification.find({ userId })
      .populate('orderId')
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
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
// // Get all orders for a vendor
// router.get('/vendor/:serviceOwnerId', async (req, res) => {
//   try {
//     // Populate serviceId and userId including profileImage
//     let orders = await Order.find({ serviceOwnerId: req.params.serviceOwnerId })
//       .populate('serviceId', 'serviceName price') // service info
//       .populate('userId', 'firstname lastname location phone email profileImage') // user info + profileImage
//       .sort({ createdAt: -1 });

//     // Now orders already include userId.profileImage (Cloudinary URL)

//     res.status(200).json(orders);
//   } catch (error) {
//     console.error('Error fetching vendor orders:', error);
//     res.status(500).json({ message: 'Error fetching orders' });
//   }
// });


router.get('/vendor/:serviceOwnerId', async (req, res) => {
  try {
    // Step 1: Get orders with basic user info from User model
    let orders = await Order.find({ serviceOwnerId: req.params.serviceOwnerId })
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname location phone email') // no profileImage here
      .sort({ createdAt: -1 });

    // Step 2: Get userIds to fetch Profile documents
   const emails = orders.map(order => order.userId.email);

    // Step 3: Fetch profiles linked to these users
    // Assuming Profile documents store the user's ObjectId under 'userId' or by matching email (adjust as needed)
    const profiles = await Profile.find({ email: { $in: emails } }).select('email profileImage');

    // Step 4: Map profileImage into the orders
   orders = orders.map(order => {
  const profile = profiles.find(p => p.email === order.userId.email);
  return {
    ...order.toObject(),
    userId: {
      ...order.userId.toObject(),
      profileImage: profile?.profileImage || null,
    }
  };
});


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

// //Fetch order tracking by order ID
// router.get('/tracking/order/:orderId', async (req, res) => {
//   try {
//     const orderId = req.params.orderId;

//     if (!mongoose.Types.ObjectId.isValid(orderId)) {
//       return res.status(400).json({ message: 'Invalid orderId format' });
//     }

//     const tracking = await Tracking.findOne({ orderId: mongoose.Types.ObjectId(orderId) })
//       .populate('orderId')
//       .exec();

//     if (!tracking) {
//       return res.status(404).json({ message: 'Tracking record not found' });
//     }

//     res.status(200).json(tracking);
//   } catch (error) {
//     console.error('Error fetching tracking:', error);
//     res.status(500).json({ message: 'Error fetching tracking' });
//   }
// });

router.get('/tracking/order/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: 'Invalid orderId format' });
    }

    const tracking = await Tracking.findOne({ orderId: mongoose.Types.ObjectId(orderId) })
      .populate({
        path: 'orderId',
        populate: [
          {
            path: 'userId',
            select: 'name profileImage location' // get specific user fields
          },
          {
            path: 'services',
            select: 'name price' // get service name and price
          }
        ]
      })
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