// const mongoose = require('mongoose');

// const serviceSchema = new mongoose.Schema({
//     // vendorId: mongoose.Schema.Types.ObjectId,
//     serviceName: String,
//     category: String,
//     description: String,
//     price: Number,
//     availability: Boolean,
//     imageUrl: String, 
//     serviceOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Ensure required and proper ref
//   });

  
//   module.exports = mongoose.model('Service', serviceSchema);
  
  
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
