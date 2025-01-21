const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken')

const router = express.Router();


// Register
router.post('/register', async (req, res) => {
  try {
    const { firstname, lastname, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ firstname,lastname, email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    // Check if user exists and validate password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);

    // Assuming the 'vendorId' is a field in the User model
    res.json({
      token,
      userId: user._id, // Include vendorId in the response
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


module.exports = router;
