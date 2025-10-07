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
    
    // Add logging for debugging
    console.log('Admin login attempt for:', email);
    
    const user = await Admin.findOne({ email });

    // Check if user exists and validate password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('Invalid credentials for admin login');
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    // Generate token
    const token = generateToken(user);
    
    console.log('Admin login successful for:', email);

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
