const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/adminModel');
require('dotenv').config();

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB,
    });
    console.log('Connected to MongoDB');

    // Check if admin user already exists
    const existingAdmin = await Admin.findOne({ email: 'servixpress247@gmail.com' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
      return;
    }

    // Create admin user
    const adminData = {
      firstname: 'Service',
      lastname: 'Admin',
      email: 'servixpress247@gmail.com',
      password: await bcrypt.hash('Admin123!', 10),
      role: 'admin',
      phone: '+1234567890',
      location: 'System Administrator'
    };

    const adminUser = new Admin(adminData);
    await adminUser.save();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: servixpress247@gmail.com');
    console.log('🔐 Password: Admin123!');
    console.log('🆔 User ID:', adminUser._id);
    console.log('🔢 User Code:', adminUser.usercode);
    console.log('\n⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
createAdminUser();