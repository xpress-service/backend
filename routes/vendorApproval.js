const express = require('express');
const User = require('../models/userModel');
const auth = require('../middlewares/auth');
const { sendVendorApprovalEmail } = require('../utils/emailService');

const router = express.Router();

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all pending vendor applications
router.get('/pending-vendors', auth, requireAdmin, async (req, res) => {
  try {
    const pendingVendors = await User.find({
      role: 'vendor',
      vendorStatus: 'pending',
      isEmailVerified: true
    }).select('-password -emailVerificationToken').sort({ dateJoined: -1 });
    
    res.json({
      pendingVendors,
      count: pendingVendors.length
    });
  } catch (error) {
    console.error('Error fetching pending vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all vendors with their status
router.get('/vendors', auth, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = { role: 'vendor' };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.vendorStatus = status;
    }
    
    const vendors = await User.find(query)
      .select('-password -emailVerificationToken')
      .populate('approvedBy', 'firstname lastname email')
      .sort({ dateJoined: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    const total = await User.countDocuments(query);
    
    res.json({
      vendors,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalVendors: total
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vendor details
router.get('/vendor/:id', auth, requireAdmin, async (req, res) => {
  try {
    const vendor = await User.findById(req.params.id)
      .select('-password -emailVerificationToken')
      .populate('approvedBy', 'firstname lastname email');
      
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve vendor
router.patch('/approve-vendor/:id', auth, requireAdmin, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const adminId = req.user.userId;
    
    const vendor = await User.findById(vendorId);
    
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    if (!vendor.isEmailVerified) {
      return res.status(400).json({ message: 'Vendor email must be verified before approval' });
    }
    
    if (vendor.vendorStatus === 'approved') {
      return res.status(400).json({ message: 'Vendor is already approved' });
    }
    
    // Update vendor status
    vendor.vendorStatus = 'approved';
    vendor.approvedBy = adminId;
    vendor.approvedAt = new Date();
    vendor.rejectionReason = undefined; // Clear any previous rejection reason
    await vendor.save();
    
    // Send approval email
    const emailSent = await sendVendorApprovalEmail(
      vendor.email, 
      vendor.firstname, 
      true
    );
    
    if (!emailSent) {
      console.warn(`Failed to send approval email to ${vendor.email}`);
    }
    
    res.json({ 
      message: 'Vendor approved successfully',
      vendor: {
        id: vendor._id,
        name: `${vendor.firstname} ${vendor.lastname}`,
        email: vendor.email,
        vendorStatus: vendor.vendorStatus,
        approvedAt: vendor.approvedAt
      },
      emailSent
    });
  } catch (error) {
    console.error('Error approving vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject vendor
router.patch('/reject-vendor/:id', auth, requireAdmin, async (req, res) => {
  try {
    const vendorId = req.params.id;
    const { rejectionReason } = req.body;
    const adminId = req.user.userId;
    
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    const vendor = await User.findById(vendorId);
    
    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    if (vendor.vendorStatus === 'rejected') {
      return res.status(400).json({ message: 'Vendor is already rejected' });
    }
    
    // Update vendor status
    vendor.vendorStatus = 'rejected';
    vendor.rejectionReason = rejectionReason.trim();
    vendor.approvedBy = adminId;
    vendor.approvedAt = new Date();
    await vendor.save();
    
    // Send rejection email
    const emailSent = await sendVendorApprovalEmail(
      vendor.email, 
      vendor.firstname, 
      false, 
      rejectionReason
    );
    
    if (!emailSent) {
      console.warn(`Failed to send rejection email to ${vendor.email}`);
    }
    
    res.json({ 
      message: 'Vendor rejected successfully',
      vendor: {
        id: vendor._id,
        name: `${vendor.firstname} ${vendor.lastname}`,
        email: vendor.email,
        vendorStatus: vendor.vendorStatus,
        rejectionReason: vendor.rejectionReason,
        rejectedAt: vendor.approvedAt
      },
      emailSent
    });
  } catch (error) {
    console.error('Error rejecting vendor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vendor approval statistics
router.get('/vendor-stats', auth, requireAdmin, async (req, res) => {
  try {
    const stats = await Promise.all([
      User.countDocuments({ role: 'vendor', vendorStatus: 'pending', isEmailVerified: true }),
      User.countDocuments({ role: 'vendor', vendorStatus: 'approved' }),
      User.countDocuments({ role: 'vendor', vendorStatus: 'rejected' }),
      User.countDocuments({ role: 'vendor', isEmailVerified: false })
    ]);
    
    res.json({
      pendingApproval: stats[0],
      approved: stats[1],
      rejected: stats[2],
      unverifiedEmail: stats[3],
      total: stats[0] + stats[1] + stats[2] + stats[3]
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk approve vendors
router.patch('/bulk-approve', auth, requireAdmin, async (req, res) => {
  try {
    const { vendorIds } = req.body;
    const adminId = req.user.userId;
    
    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return res.status(400).json({ message: 'Vendor IDs array is required' });
    }
    
    const vendors = await User.find({
      _id: { $in: vendorIds },
      role: 'vendor',
      isEmailVerified: true,
      vendorStatus: 'pending'
    });
    
    if (vendors.length === 0) {
      return res.status(400).json({ message: 'No eligible vendors found for approval' });
    }
    
    // Update all vendors
    const approvedVendors = [];
    for (const vendor of vendors) {
      vendor.vendorStatus = 'approved';
      vendor.approvedBy = adminId;
      vendor.approvedAt = new Date();
      await vendor.save();
      
      // Send approval email (don't wait for it)
      sendVendorApprovalEmail(vendor.email, vendor.firstname, true)
        .catch(err => console.warn(`Failed to send approval email to ${vendor.email}:`, err));
      
      approvedVendors.push({
        id: vendor._id,
        name: `${vendor.firstname} ${vendor.lastname}`,
        email: vendor.email
      });
    }
    
    res.json({ 
      message: `${approvedVendors.length} vendors approved successfully`,
      approvedVendors
    });
  } catch (error) {
    console.error('Error bulk approving vendors:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;