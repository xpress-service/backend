const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/adminModel');
require('dotenv').config();

async function verifyAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB,
    });
    console.log('Connected to MongoDB');

    // Find admin user
    const admin = await Admin.findOne({ email: 'servixpress247@gmail.com' });
    
    if (!admin) {
      console.log('❌ No admin user found with email: servixpress247@gmail.com');
      return;
    }

    console.log('✅ Admin user found:');
    console.log('📧 Email:', admin.email);
    console.log('👤 Name:', admin.firstname, admin.lastname);
    console.log('🆔 User ID:', admin._id);
    console.log('🔢 User Code:', admin.usercode);
    console.log('📅 Date Joined:', admin.dateJoined);

    // Test password verification
    const testPassword = 'Admin123!';
    const isPasswordValid = await bcrypt.compare(testPassword, admin.password);
    
    console.log('🔐 Password Test:');
    console.log('   Password "Admin123!" is valid:', isPasswordValid);
    
    // If password is invalid, let's reset it
    if (!isPasswordValid) {
      console.log('🔄 Resetting admin password...');
      admin.password = await bcrypt.hash('Admin123!', 10);
      await admin.save();
      console.log('✅ Password reset successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the verification
verifyAdmin();