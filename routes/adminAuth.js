const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const generateToken = require('../utils/generateToken')

const router = express.Router();


// Register
router.post('/admin-register', async (req, res) => {
  try {
    const { firstname, lastname, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new Admin({ firstname,lastname, email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Enhanced logging for debugging
    console.log('=== ADMIN LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('Password provided:', !!password);
    console.log('Request origin:', req.headers.origin);
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Validate input
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await Admin.findOne({ email });
    console.log('User found:', !!user);

    if (!user) {
      console.log('No admin user found with email:', email);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Test password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Invalid password for admin:', email);
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Generate token
    const token = generateToken(user);
    
    console.log('Admin login successful for:', email);
    console.log('Generated token:', !!token);

    // Return admin login response
    res.json({
      token,
      userId: user._id,
      role: user.role || 'admin',
      message: 'Admin login successful'
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during admin login',
      message: 'Something went wrong. Please try again.' 
    });
  }
});


module.exports = router;
