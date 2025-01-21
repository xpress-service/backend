const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  nin: Number,
  role: { type: String, enum: ['vendor', 'customer'] },
  servicesOffered: [String],
  location: String,
  contactInfo: String,
  profileImage: String, 
});

module.exports = mongoose.model('Profile', userSchema);
