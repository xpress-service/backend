const express = require('express');
const mongoose = require('mongoose');
const Order = require('../models/orderModel');
const User = require('../models/userModel')
const Profile = require('../models/profileModel')
const Service = require('../models/serviceModel');
const Notification = require('../models/notificationModel');
const Tracking = require('../models/trackingModel');
const authenticateToken = require('../middlewares/auth');
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
console.log('Creating notification for vendor:', serviceOwnerId);
    const notification = new Notification({
      serviceOwnerId,
      orderId: savedOrder._id,
      message: `You have a new order for your service: ${service.serviceName}. Please review and approve/reject this order.`,
      notificationType: 'order_placed',
      actionRequired: true
    });

    await notification.save();
    console.log('Saved vendor notification:', notification);

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


// GET /orders/notifications/:serviceOwnerId - Legacy vendor endpoint (unread only)
router.get('/notifications/:serviceOwnerId', async (req, res) => {
  try {
    console.log('Legacy vendor notifications endpoint for:', req.params.serviceOwnerId);
    const notifications = await Notification.find({ serviceOwnerId: req.params.serviceOwnerId, isRead: false })
      .populate({
        path: 'orderId',
        populate: [
          { path: 'userId', select: 'firstname lastname location phone email' },
          { path: 'serviceId', select: 'serviceName price' }
        ]
      })
      .sort({ createdAt: -1 });

    console.log('Found vendor notifications:', notifications.length);
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// GET /orders/notifications/vendor/:serviceOwnerId - Get all notifications for vendors
router.get('/notifications/vendor/:serviceOwnerId', async (req, res) => {
  try {
    console.log('Fetching vendor notifications for serviceOwnerId:', req.params.serviceOwnerId);
    const notifications = await Notification.find({ serviceOwnerId: req.params.serviceOwnerId })
      .populate({
        path: 'orderId',
        populate: [
          { path: 'userId', select: 'firstname lastname location phone email' },
          { path: 'serviceId', select: 'serviceName price' }
        ]
      })
      .sort({ createdAt: -1 });
    
    console.log('Found all vendor notifications:', notifications.length);
    res.status(200).json({ notifications });
  } catch (error) {
    console.error('Error fetching vendor notifications:', error);
    res.status(500).json({ message: 'Error fetching vendor notifications' });
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

    // Get order details for notification
    const orderWithDetails = await Order.findById(order._id)
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname');

    // Notify the user who placed the order
    const userNotification = new Notification({
      userId: order.userId, // the customer
      orderId: order._id,
      message:
        status === 'Approved'
          ? `Great news! Your order for "${orderWithDetails.serviceId.serviceName}" has been approved by the vendor. Please proceed with payment to confirm your booking.`
          : `Unfortunately, your order for "${orderWithDetails.serviceId.serviceName}" has been rejected by the vendor. You can try booking another service or contact support for assistance.`,
      notificationType: status === 'Approved' ? 'order_approved' : 'order_rejected',
      actionRequired: status === 'Approved' ? true : false
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

// GET /orders/notifications/user/:userId - Get notifications for customers
router.get('/notifications/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    console.log('Fetching customer notifications for userId:', userId);
    const notifications = await Notification.find({ userId: userId })
      .populate({
        path: 'orderId',
        populate: {
          path: 'serviceId',
          select: 'serviceName price'
        }
      })
      .sort({ createdAt: -1 });
    
    console.log('Found customer notifications:', notifications.length);
    res.status(200).json({ notifications });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});



// Mark notifications as read
router.patch('/notifications/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    // Validate notification ID
    if (!notificationId || notificationId === 'undefined' || notificationId === 'null') {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    // Validate ObjectId format
    if (!notificationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid notification ID format' });
    }
    
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
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
      .populate('serviceId', 'serviceName title price category')
      .populate('userId', 'firstname lastname location phone email')
      .sort({ createdAt: -1 });

    // Step 2: Get userIds to fetch Profile documents
    const emails = orders.map(order => order.userId.email);

    // Step 3: Fetch profiles linked to these users
    const profiles = await Profile.find({ email: { $in: emails } }).select('email profileImage');

    // Step 4: Map profileImage and transform to transaction format
    const transactions = orders.map(order => {
      const profile = profiles.find(p => p.email === order.userId.email);
      const servicePrice = order.serviceId.price || 0;
      const quantity = order.quantity || 1;
      const totalAmount = servicePrice * quantity;
      const platformFeeRate = 0.1; // 10% platform fee
      const platformFee = totalAmount * platformFeeRate;
      const vendorReceives = totalAmount - platformFee;

      return {
        _id: order._id,
        serviceId: {
          _id: order.serviceId._id,
          title: order.serviceId.title || order.serviceId.serviceName,
          serviceName: order.serviceId.serviceName,
          price: servicePrice,
          category: order.serviceId.category || 'General',
          vendorId: {
            _id: req.params.serviceOwnerId,
            firstname: 'Vendor',
            lastname: 'User',
            email: 'vendor@example.com'
          }
        },
        userId: {
          _id: order.userId._id,
          firstname: order.userId.firstname,
          lastname: order.userId.lastname,
          email: order.userId.email,
          profileImage: profile?.profileImage || null,
        },
        status: order.status.toLowerCase(),
        paymentStatus: order.isPaid ? 'paid' : (order.paymentStatus || 'pending'),
        paymentMethod: order.paymentMethod || 'offline',
        paymentProof: order.paymentProof,
        platformFee: order.platformFee || platformFee,
        vendorReceives: order.vendorReceives || vendorReceives,
        totalAmount: totalAmount,
        quantity: quantity,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
        completedAt: order.status === 'Approved' ? order.confirmedAt : null,
        refundedAt: order.refundedAt,
        refundAmount: order.status === 'refunded' ? totalAmount : null
      };
    });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching vendor transactions:', error);
    res.status(500).json({ message: 'Error fetching vendor transactions' });
  }
});

// GET /orders/user - Get orders for a specific user (customer orders)
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.userId; // Get from authentication middleware
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Step 1: Get orders where the user is the customer
    let orders = await Order.find({ userId: userId })
      .populate('serviceId', 'serviceName title price category')
      .populate('userId', 'firstname lastname location phone email')
      .sort({ createdAt: -1 });

    // Step 2: Get service owner emails to fetch their profile images
    const serviceOwnerIds = orders.map(order => order.serviceOwnerId).filter(Boolean);
    
    // Step 3: Find User documents for service owners to get their details
    const serviceOwners = await User.find({ _id: { $in: serviceOwnerIds } }).select('email _id firstname lastname location phone');
    const serviceOwnerEmails = serviceOwners.map(owner => owner.email);

    // Step 4: Fetch profiles for service owners
    const profiles = await Profile.find({ email: { $in: serviceOwnerEmails } }).select('email profileImage');

    // Step 5: Transform to transaction format with service provider info
    const transactions = orders.map(order => {
      const serviceOwner = serviceOwners.find(owner => owner._id.toString() === order.serviceOwnerId.toString());
      const profile = profiles.find(p => p.email === serviceOwner?.email);
      const servicePrice = order.serviceId.price || 0;
      const quantity = order.quantity || 1;
      const totalAmount = servicePrice * quantity;
      const platformFeeRate = 0.1; // 10% platform fee
      const platformFee = totalAmount * platformFeeRate;
      const vendorReceives = totalAmount - platformFee;
      
      return {
        _id: order._id,
        serviceId: {
          _id: order.serviceId._id,
          title: order.serviceId.title || order.serviceId.serviceName,
          serviceName: order.serviceId.serviceName,
          price: servicePrice,
          category: order.serviceId.category || 'General',
          vendorId: {
            _id: serviceOwner?._id || order.serviceOwnerId,
            firstname: serviceOwner?.firstname || 'Unknown',
            lastname: serviceOwner?.lastname || 'Provider',
            email: serviceOwner?.email || null,
            profileImage: profile?.profileImage || null,
          }
        },
        userId: {
          _id: order.userId._id,
          firstname: order.userId.firstname,
          lastname: order.userId.lastname,
          email: order.userId.email
        },
        status: order.status.toLowerCase(),
        paymentStatus: order.isPaid ? 'paid' : (order.paymentStatus || 'pending'),
        paymentMethod: order.paymentMethod || 'offline',
        paymentProof: order.paymentProof,
        platformFee: order.platformFee || platformFee,
        vendorReceives: order.vendorReceives || vendorReceives,
        totalAmount: totalAmount,
        quantity: quantity,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
        completedAt: order.status === 'Approved' ? order.confirmedAt : null,
        refundedAt: order.refundedAt,
        refundAmount: order.status === 'refunded' ? totalAmount : null
      };
    });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ message: 'Error fetching user transactions' });
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

    const tracking = await Tracking.findOne({ orderId: new mongoose.Types.ObjectId(orderId) })
      .populate({
        path: 'orderId',
        populate: [
          {
            path: 'userId',
            select: 'name profileImage location' // get specific user fields
          },
          {
            path: 'serviceId',
            select: 'serviceName price' // get service name and price
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
    const order = await Order.findById(orderId)
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname email');
    
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Calculate commission for both online and offline payments
    const serviceAmount = order.serviceId.price * order.quantity;
    const platformFee = Math.round(serviceAmount * 0.10 * 100) / 100; // 10% platform fee
    const vendorReceives = Math.round((serviceAmount - platformFee) * 100) / 100;

    order.paymentMethod = method;
    order.platformFee = platformFee;
    order.vendorReceives = vendorReceives;
    
    if (method === 'offline') {
      // Mark as unpaid until manually confirmed
      order.isPaid = false;
      order.paymentStatus = 'pending_confirmation'; // New status for offline payments
      await order.save();
      
      return res.status(200).json({ 
        message: 'Offline payment selected. Please arrange payment with the vendor.',
        platformFee: platformFee,
        vendorReceives: vendorReceives,
        totalAmount: serviceAmount
      });
    }

    await order.save();
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
    const order = await Order.findById(orderId)
      .populate('userId', 'email firstname lastname')
      .populate('serviceId', 'serviceName price');
    
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Check if order is approved
    if (order.status !== 'Approved') {
      return res.status(400).json({ message: 'Order must be approved before payment' });
    }

    // Check if already paid
    if (order.isPaid) {
      return res.status(400).json({ message: 'Order has already been paid' });
    }

    // Calculate amounts with 10% platform fee
    const serviceAmount = order.serviceId.price * order.quantity;
    const platformFee = Math.round(serviceAmount * 0.10 * 100) / 100; // 10% platform fee
    const vendorReceives = Math.round((serviceAmount - platformFee) * 100) / 100;
    const totalAmount = serviceAmount; // Customer pays full amount
    
    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: order.userId.email,
        amount: Math.floor(totalAmount * 100), // Convert to Kobo
        currency: 'NGN',
        reference: `xpress_${orderId}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success?orderId=${orderId}`,
        metadata: {
          orderId: orderId,
          customerId: order.userId._id,
          customerName: `${order.userId.firstname} ${order.userId.lastname}`,
          serviceName: order.serviceId.serviceName,
          quantity: order.quantity
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update order with payment reference and fee breakdown
    order.paymentReference = paystackRes.data.data.reference;
    order.paymentMethod = 'online';
    order.platformFee = platformFee;
    order.vendorReceives = vendorReceives;
    await order.save();

    res.status(200).json({
      authorization_url: paystackRes.data.data.authorization_url,
      access_code: paystackRes.data.data.access_code,
      reference: paystackRes.data.data.reference,
      amount: totalAmount,
      platformFee: platformFee,
      vendorReceives: vendorReceives
    });

  } catch (error) {
    console.error('Error initializing Paystack payment:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// Payment verification endpoint
router.post('/payments/verify', async (req, res) => {
  const { reference, orderId } = req.body;

  try {
    // Verify payment with Paystack
    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paymentData = verificationResponse.data.data;

    if (paymentData.status === 'success') {
      // Update order as paid
      const order = await Order.findByIdAndUpdate(
        orderId,
        { 
          isPaid: true,
          paymentReference: reference,
          paymentMethod: 'online'
        },
        { new: true }
      ).populate('serviceId', 'serviceName price')
       .populate('userId', 'firstname lastname email');

      if (!order) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }

      // Create payment success notification
      const paymentNotification = new Notification({
        userId: order.userId._id,
        orderId: order._id,
        message: `Payment successful! Your order for "${order.serviceId.serviceName}" has been confirmed. The service provider will contact you soon.`,
        notificationType: 'payment_successful',
        actionRequired: false
      });
      await paymentNotification.save();

      // Create notification for service provider
      const providerNotification = new Notification({
        serviceOwnerId: order.serviceOwnerId,
        orderId: order._id,
        message: `Great news! Payment has been received for your service "${order.serviceId.serviceName}". You can now proceed with service delivery.`,
        notificationType: 'payment_successful',
        actionRequired: true
      });
      await providerNotification.save();

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        orderDetails: {
          serviceName: order.serviceId.serviceName,
          totalAmount: order.serviceId.price * order.quantity,
          platformFee: order.platformFee,
          vendorReceives: order.vendorReceives,
          reference: reference
        }
      });
    } else {
      // Payment failed
      const order = await Order.findById(orderId)
        .populate('serviceId', 'serviceName')
        .populate('userId', 'firstname lastname');

      if (order) {
        // Create payment failed notification
        const failedNotification = new Notification({
          userId: order.userId._id,
          orderId: order._id,
          message: `Payment failed for your order "${order.serviceId.serviceName}". Please try again or contact support.`,
          notificationType: 'payment_failed',
          actionRequired: true
        });
        await failedNotification.save();
      }

      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying payment:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Payment verification error'
    });
  }
});

// Get single order endpoint
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ message: 'Error fetching order' });
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

// Manual payment confirmation for offline payments
router.patch('/payments/confirm-offline/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { confirmedBy, paymentProof, notes } = req.body;

  try {
    const order = await Order.findById(orderId)
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname email');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.paymentMethod !== 'offline') {
      return res.status(400).json({ message: 'This order is not set for offline payment' });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: 'Payment already confirmed for this order' });
    }

    // Update order with payment confirmation
    order.isPaid = true;
    order.paymentStatus = 'confirmed';
    order.paymentProof = paymentProof;
    order.confirmedBy = confirmedBy;
    order.confirmedAt = new Date();
    
    await order.save();

    // Create payment confirmation notifications
    const userNotification = new Notification({
      userId: order.userId._id,
      orderId: order._id,
      message: `Payment confirmed! Your offline payment for "${order.serviceId.serviceName}" has been verified. Service delivery will begin soon.`,
      notificationType: 'payment_successful',
      actionRequired: false
    });
    await userNotification.save();

    const vendorNotification = new Notification({
      serviceOwnerId: order.serviceOwnerId,
      orderId: order._id,
      message: `Offline payment confirmed for "${order.serviceId.serviceName}". You can now proceed with service delivery.`,
      notificationType: 'payment_successful',
      actionRequired: true
    });
    await vendorNotification.save();

    res.status(200).json({
      success: true,
      message: 'Offline payment confirmed successfully',
      order: {
        _id: order._id,
        serviceName: order.serviceId.serviceName,
        totalAmount: order.serviceId.price * order.quantity,
        platformFee: order.platformFee,
        vendorReceives: order.vendorReceives,
        paymentStatus: order.paymentStatus,
        confirmedAt: order.confirmedAt
      }
    });

  } catch (error) {
    console.error('Error confirming offline payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending offline payments for admin/vendor confirmation
router.get('/payments/pending-offline/:serviceOwnerId?', async (req, res) => {
  try {
    const { serviceOwnerId } = req.params;
    let query = { 
      paymentMethod: 'offline', 
      paymentStatus: 'pending_confirmation',
      isPaid: false 
    };

    // If serviceOwnerId provided, filter by vendor
    if (serviceOwnerId) {
      query.serviceOwnerId = serviceOwnerId;
    }

    const pendingPayments = await Order.find(query)
      .populate('serviceId', 'serviceName price')
      .populate('userId', 'firstname lastname email phone')
      .populate('serviceOwnerId', 'firstname lastname email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingPayments: pendingPayments,
      count: pendingPayments.length
    });

  } catch (error) {
    console.error('Error fetching pending offline payments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;