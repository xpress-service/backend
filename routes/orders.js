// const express = require('express');
// const Order = require('../models/orderModel');
// const router = express.Router();

// // Create Order
// router.post('/', async (req, res) => {
//   try {
//     const order = new Order(req.body);
//     await order.save();
//     res.status(201).json(order);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// // Get Orders
// router.get('/', async (req, res) => {
//   try {
//     const orders = await Order.find();
//     res.json(orders);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// // Update Order Status
// router.put('/:id', async (req, res) => {
//   try {
//     const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
//     res.json(order);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// });

// module.exports = router;


const express = require('express');
const Order = require('../models/orderModel');
const Service = require('../models/serviceModel');
const Notification = require('../models/notificationModel');
const router = express.Router();


//Place Order Route
// router.post('/', async (req, res) => {
//   const { serviceId, userId, quantity } = req.body;

//   try {
//     if (!serviceId || !userId || !quantity) {
//       return res.status(400).json({ message: 'All fields are required.' });
//     }

//     const service = await Service.findById(serviceId);
//     if (!service) {
//       return res.status(404).json({ message: 'Service not found.' });
//     }

//     const serviceOwnerId = service.serviceOwnerId;
//     if (!serviceOwnerId) {
//       return res.status(400).json({ message: 'Service owner not found for this service.' });
//     }

//     const newOrder = new Order({
//       serviceId,
//       userId,
//       serviceOwnerId,
//       quantity,
//     });

//     const savedOrder = await newOrder.save();

//     const notification = new Notification({
//       serviceOwnerId,
//       orderId: savedOrder._id,
//       message: `You have a new order for your service: ${service.serviceName}`,
//     });

//     await notification.save();

//     res.status(201).json({
//       message: 'Order placed successfully',
//       order: savedOrder,
//     });
//   } catch (error) {
//     console.error('Error placing order:', error);
//     res.status(500).json({ message: 'Error placing order', error: error.message });
//   }
// });


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



// router.post('/', async (req, res) => {
//   const { serviceId, userId, quantity } = req.body;

//   try {
//     if (!serviceId || !userId || !quantity) {
//       return res.status(400).json({ message: 'All fields are required.' });
//     }

//     // Fetch the service
//     const service = await Service.findById(serviceId);
//     if (!service) {
//       return res.status(404).json({ message: 'Service not found.' });
//     }

//     // Dynamically fetch serviceOwnerId (Example: From ServiceOwner or related data)
//     const serviceOwner = await Order.findOne({ order: serviceId }); // Adjust query if necessary
//     if (!serviceOwner) {
//       return res.status(400).json({ message: 'Service owner not found for this service.' });
//     }

//     const serviceOwnerId = serviceOwner._id;

//     // Create the order
//     const newOrder = new Order({
//       serviceId,
//       userId,
//       serviceOwnerId,
//       quantity,
//     });

//     const savedOrder = await newOrder.save();

//     // Send a notification
//     const notification = new Notification({
//       serviceOwnerId,
//       orderId: savedOrder._id,
//       message: `You have a new order for your service: ${service.serviceName}`,
//     });

//     await notification.save();

//     res.status(201).json({
//       message: 'Order placed successfully',
//       order: savedOrder,
//     });
//   } catch (error) {
//     console.error('Error placing order:', error);
//     res.status(500).json({ message: 'Error placing order', error: error.message });
//   }
// });





//Get Notifications for Service Owner
// router.get('/notifications/:serviceOwnerId', async (req, res) => {
//   try {
//     const notifications = await Notification.find({ serviceOwnerId: req.params.serviceOwnerId, isRead: false })
//       .populate('orderId')
//       .sort({ createdAt: -1 });

//     res.status(200).json(notifications);
//   } catch (error) {
//     console.error('Error fetching notifications:', error);
//     res.status(500).json({ message: 'Error fetching notifications' });
//   }
// });


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



//Approve or Reject Order
// Approve or reject an order
router.patch('/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body; // 'Approved' or 'Rejected'

  try {
    const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Optionally, send a notification or update the user in case the status changes
    const notification = new Notification({
      serviceOwnerId: order.serviceOwnerId,
      orderId: order._id,
      message: `Your order has been ${status.toLowerCase()}.`,
    });
    
    await notification.save();

    res.status(200).json({ message: `Order ${status.toLowerCase()} successfully`, order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Error updating order status' });
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
// router.get('/vendor/:serviceOwnerId', async (req, res) => {
//   try {
//     const orders = await Order.find({ serviceOwnerId: req.params.serviceOwnerId })
//       .populate('serviceId')
//       .populate('userId'); // Populate service and user information
//     res.status(200).json(orders);
//   } catch (error) {
//     console.error('Error fetching vendor orders:', error);
//     res.status(500).json({ message: 'Error fetching orders' });
//   }
// });

router.get('/vendor/:serviceOwnerId', async (req, res) => {
  try {
    const orders = await Order.find({ serviceOwnerId: req.params.serviceOwnerId })
      .populate('serviceId')  // Populate service details
      .populate('userId', 'firstname lastname location phone email')  // Populate user details (username, location, phone, email)
      .sort({ createdAt: -1 });  // Optionally sort by createdAt or any other field

    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching vendor orders:', error);
    res.status(500).json({ message: 'Error fetching orders' });
  }
});


module.exports = router;