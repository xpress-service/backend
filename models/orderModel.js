const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'refunded'], default: 'Pending' },

  // Payment-related fields:
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['online', 'offline'], default: null },
  paymentReference: { type: String, default: null },
  paymentStatus: { type: String, enum: ['pending', 'pending_confirmation', 'confirmed', 'failed'], default: 'pending' },
  paymentProof: { type: String, default: null }, // For offline payment proof
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin/Vendor who confirmed
  confirmedAt: { type: Date },
  platformFee: { type: Number, default: 0 },
  vendorReceives: { type: Number, default: 0 },

    // Add the quantity field here:
  quantity: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now },
  orderDate: Date,

  // Refund fields
  refundReason: { type: String },
  refundedAt: { type: Date },
  refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryDate: Date,
  location: String,
});
module.exports = mongoose.model('Order', orderSchema);