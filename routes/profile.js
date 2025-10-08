const express = require('express');
const multer = require('multer');
const User = require('../models/userModel');
const authenticateToken = require('../middlewares/auth');
const cloudinary = require('../cloudinaryConfig');
const router = express.Router();

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function for Cloudinary upload with timeout
const uploadImageToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Cloudinary upload timeout - check internet connection'));
        }, 10000); // 10 second timeout

        const stream = cloudinary.uploader.upload_stream(
            { 
                resource_type: "image", 
                folder: "learning",
                timeout: 10000 // Cloudinary timeout
            },
            (error, result) => {
                clearTimeout(timeout);
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new Error(`Cloudinary error: ${error.message}`));
                }
                resolve(result);
            }
        );
        stream.end(fileBuffer);
    });
};

// Get User Profile
router.get('/', authenticateToken, async (req, res) => {
  console.log("Request received:", req.headers);
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error("Error fetching user data:", error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});


// Update User Profile with Image
router.put('/', authenticateToken, upload.single('profileImage'), async (req, res) => {
    try {
        const updates = { ...req.body };

        // Exclude sensitive fields from being updated
        delete updates._id;
        delete updates.password;

        // Handle image upload if file is provided
        if (req.file) {
            try {
                const result = await uploadImageToCloudinary(req.file.buffer);
                updates.profileImage = result.secure_url; // Store the image URL
            } catch (cloudinaryError) {
                console.warn('Cloudinary upload failed:', cloudinaryError.message);
                // Continue without image upload if Cloudinary fails
                // You can choose to either skip the image or return an error
                // For now, we'll skip the image and continue with profile update
                delete updates.profileImage;
            }
        }

        // Update user in the database
        const updatedUser = await User.findByIdAndUpdate(req.user.userId, updates, { new: true });
        if (!updatedUser) return res.status(404).json({ message: 'User not found' });

        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Update Notification Preferences
router.patch('/notifications', authenticateToken, async (req, res) => {
    try {
        const { emailNotifications, pushNotifications, orderUpdates, promotionalEmails } = req.body;
        
        const updates = {
            notificationSettings: {
                emailNotifications: emailNotifications !== undefined ? emailNotifications : true,
                pushNotifications: pushNotifications !== undefined ? pushNotifications : true,
                orderUpdates: orderUpdates !== undefined ? orderUpdates : true,
                promotionalEmails: promotionalEmails !== undefined ? promotionalEmails : false
            }
        };

        const updatedUser = await User.findByIdAndUpdate(
            req.user.userId, 
            updates, 
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ 
            message: 'Notification preferences updated successfully',
            notificationSettings: updatedUser.notificationSettings 
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
