const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const auth = require('../middlewares/auth');
const { sendVerificationEmail, testEmailConnection } = require('../utils/emailService');
const { validatePassword, validateEmail, validateNames } = require('../middlewares/validation');

const router = express.Router();


// Register
router.post('/register', validateNames, validateEmail, validatePassword, async (req, res) => {
  try {
    const { firstname, lastname, email, password, role } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user object
    const userData = {
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role
    };
    
    // All users require email verification
    const verificationToken = crypto.randomBytes(32).toString('hex');
    userData.emailVerificationToken = verificationToken;
    userData.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    userData.isEmailVerified = false; // All users start unverified
    
    // Additional setup for vendors
    if (role === 'vendor') {
      userData.vendorStatus = 'pending';
    }
    
    const user = new User(userData);
    await user.save();
    
    // Send verification email to all users
    const emailSent = await sendVerificationEmail(email, verificationToken, firstname, role);
    
    const roleText = role === 'vendor' ? 'vendor' : 'customer';
    const additionalMessage = role === 'vendor' ? ' After verification, an admin will review your application.' : '';
    
    if (emailSent) {
      res.status(201).json({ 
        message: `${roleText.charAt(0).toUpperCase() + roleText.slice(1)} registration successful! Please check your email to verify your account.${additionalMessage}`,
        requiresVerification: true,
        role: role
      });
    } else {
      res.status(201).json({ 
        message: `${roleText.charAt(0).toUpperCase() + roleText.slice(1)} registered but verification email failed to send. Please contact support.`,
        requiresVerification: true,
        role: role
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  console.log('🚀 LOGIN ROUTE HIT - New Request');
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
  console.log('📧 Content-Type:', req.headers['content-type']);
  
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Extracted from body:');
    console.log('   📧 Email:', email);
    console.log('   🔐 Password length:', password?.length);
    console.log('   🔐 Password:', password); // Temporary - will remove after debugging
    
    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    // Check database connection and collection
    console.log('💾 Database connection info:');
    console.log('   🏷️  Database name:', mongoose.connection.name);
    console.log('   🔗 Connection state:', mongoose.connection.readyState); // 1 = connected
    console.log('   📝 Collection name:', User.collection.name);
    
    // Check if user exists with different search patterns
    console.log('🔍 Searching for user...');
    const userExact = await User.findOne({ email: email });
    console.log('   � Exact match:', !!userExact);
    
    const userLower = await User.findOne({ email: email.toLowerCase() });
    console.log('   📧 Lowercase match:', !!userLower);
    
    const userTrimmed = await User.findOne({ email: email.trim().toLowerCase() });
    console.log('   � Trimmed+lowercase match:', !!userTrimmed);
    
    // Check for admin specifically
    const adminExists = await User.findOne({ role: 'admin' });
    console.log('   👑 Admin exists:', !!adminExists);
    if (adminExists) {
      console.log('   � Admin email in DB:', `"${adminExists.email}"`);
      console.log('   � Searching email:', `"${email}"`);
      console.log('   👑 Emails match exactly:', email === adminExists.email);
      console.log('   � Email lengths:', `DB: ${adminExists.email?.length}, Search: ${email?.length}`);
    }
    
    const user = userTrimmed || userLower || userExact;
    console.log('🔍 Final user selection:', !!user);

    if (!user) {
      console.log('❌ User not found in database after all search attempts');
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log('🔐 Password comparison result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('❌ Password does not match');
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    console.log('✅ Login validation passed - proceeding with auth checks');

    // Check if account is active
    if (!user.isActive || user.isDeleted) {
      return res.status(403).json({ message: 'Account has been deactivated. Please contact support.' });
    }

    // Check email verification for all users (except admins)
    if (!user.isEmailVerified && user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Please verify your email address before logging in. Check your email for verification link.',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Additional checks for vendors only
    if (user.role === 'vendor') {
      if (user.vendorStatus === 'pending') {
        return res.status(403).json({ 
          message: 'Your vendor application is pending admin approval. You will receive an email once approved.',
          vendorStatus: 'pending'
        });
      }
      
      if (user.vendorStatus === 'rejected') {
        return res.status(403).json({ 
          message: 'Your vendor application has been rejected. Please contact support for more information.',
          vendorStatus: 'rejected'
        });
      }
    }

    // Generate token
    const token = generateToken(user);

    // Include user info in the response
    res.json({
      token,
      userId: user._id,
      role: user.role,
      vendorStatus: user.vendorStatus,
      isEmailVerified: user.isEmailVerified,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Email Verification
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }
    
    // Find user with this verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token. Please request a new verification email.' 
      });
    }
    
    // Update user verification status
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    res.json({ 
      message: 'Email verified successfully! Your account is now pending admin approval.',
      emailVerified: true
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resend Verification Email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();
    
    // Send verification email
    console.log(`🔄 Processing resend verification for user: ${email}`);
    const emailSent = await sendVerificationEmail(email, verificationToken, user.firstname, user.role);
    
    if (emailSent) {
      console.log(`✅ Verification email sent successfully to: ${email}`);
      res.json({ 
        message: 'Verification email sent successfully!',
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      });
    } else {
      console.error(`❌ Failed to send verification email to: ${email}`);
      res.status(500).json({ 
        message: 'Failed to send verification email. Please check server logs for details.',
        error: 'Email service unavailable'
      });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Change Password (Protected Route)
router.patch('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Validate new password
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    // Hash new password and update
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(userId, { password: hashedNewPassword });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Test email configuration endpoint (for debugging in production)
router.get('/test-email', async (req, res) => {
  try {
    console.log('📧 Email configuration test requested');
    const result = await testEmailConnection();
    
    if (result.success) {
      res.json({ 
        message: 'Email service is working correctly',
        status: 'success',
        details: result
      });
    } else {
      res.status(500).json({ 
        message: 'Email service configuration issue',
        status: 'error',
        error: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('❌ Email test endpoint error:', error);
    res.status(500).json({ 
      message: 'Email test failed',
      error: error.message 
    });
  }
});

module.exports = router;
