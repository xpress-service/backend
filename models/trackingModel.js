const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const trackingSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  trackingId: { type: String, default: uuidv4, unique: true },
  status: { 
    type: String, 
    enum: ['Accepted', 'In Progress', 'Completed'], 
    default: 'Accepted' 
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tracking', trackingSchema);
