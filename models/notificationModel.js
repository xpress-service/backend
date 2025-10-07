const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for customer
  serviceOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // for vendor
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  message: { type: String, required: true },
  notificationType: { 
    type: String, 
    enum: ['order_placed', 'order_approved', 'order_rejected', 'payment_required', 'payment_successful', 'payment_failed'],
    default: 'order_placed'
  },
  actionRequired: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);

  