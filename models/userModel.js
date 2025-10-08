const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['vendor', 'customer', 'admin'] },
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
  
  // Email Verification Fields
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  
  // Vendor Approval Fields
  vendorStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: function() {
      return this.role === 'vendor' ? 'pending' : undefined;
    }
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectionReason: { type: String },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectedAt: { type: Date },
  
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    promotionalEmails: { type: Boolean, default: false }
  },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
});

// Middleware to generate usercode
userSchema.pre('save', function (next) {
  if (!this.usercode) {
    this.usercode = `SX${Math.floor(1000000 + Math.random() * 9000000)}`; // Example format: SX1234567
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
