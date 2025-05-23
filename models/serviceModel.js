const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  serviceName: String,
  category: String,
  description: String,
  price: Number,
  availability: Boolean,
  imageUrl: String,
  vendorReceives: Number, // new field
  platformFee: Number,     // 10% of price
  serviceOwnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceOwner', // Assuming you have a ServiceOwner model
    required: true, // Ensure this is always set
  },
});

module.exports = mongoose.model('Service', serviceSchema);
