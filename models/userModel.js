// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema({
//   firstname: { type: String, required: true },
//   lastname: { type: String, required: true },
//   email: { type: String, unique: true },
//   password: String,
//   role: { type: String, enum: ['vendor', 'customer'] },
//   servicesOffered: [String],
//   location: { type: String, required: true },
//   phone: { type: String, required: true },
//   profileImage: { type: String, required: true }, 
//   nin: { type: String, required: true },
//   birthdate:{ type: String, required: true },
//   gender: { type: String, required: true }
// });

// module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['vendor', 'customer'] },
  servicesOffered: [String],
  location: { type: String},
  phone: { type: String},
  profileImage: { type: String},
  nin: { type: String},
  birthdate: { type: String},
  gender: { type: String},
  usercode: { type: String, unique: true}, // New field
  dateJoined: { type: Date, default: Date.now }, // New field
});

// Middleware to generate usercode
userSchema.pre('save', function (next) {
  if (!this.usercode) {
    this.usercode = `SX${Math.floor(1000000 + Math.random() * 9000000)}`; // Example format: SX1234567
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
