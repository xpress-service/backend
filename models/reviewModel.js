const mongoose = require('mongoose');
const reviewSchema = new mongoose.Schema({
    orderId: mongoose.Schema.Types.ObjectId,
    customerId: mongoose.Schema.Types.ObjectId,
    rating: Number,
    comment: String,
  });
  
  module.exports = mongoose.model('Review', reviewSchema);
  