// const mongoose = require('mongoose');
// const orderSchema = new mongoose.Schema({
//     customerId: mongoose.Schema.Types.ObjectId,
//     serviceId: mongoose.Schema.Types.ObjectId,
//     vendorId: mongoose.Schema.Types.ObjectId,
//     orderStatus: { type: String, enum: ['pending', 'confirmed', 'completed'] },
//     orderDate: Date,
//     deliveryDate: Date,
//     location: String,
//   });
  
//   module.exports = mongoose.model('Order', orderSchema);
  
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  orderDate: Date,
  deliveryDate: Date,
  location: String,
});

module.exports = mongoose.model('Order', orderSchema);
