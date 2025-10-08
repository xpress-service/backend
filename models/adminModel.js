const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin'] },
  servicesOffered: [String],
  location: { type: String},
  country: { type: String},
  phone: { type: String},
  profileImage: { type: String},
  nin: { type: String},
  birthdate: { type: String},
  gender: { type: String},
  usercode: { type: String, unique: true}, // New field
  dateJoined: { type: Date, default: Date.now }, // New field
});

// Middleware to generate usercode
adminSchema.pre('save', function (next) {
  if (!this.usercode) {
    this.usercode = `SX${Math.floor(1000000 + Math.random() * 9000000)}`; // Example format: SX1234567
  }
  next();
});

module.exports = mongoose.model('Admin', adminSchema);
