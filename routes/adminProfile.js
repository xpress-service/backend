const express = require('express');
const multer = require('multer');
const Admin = require('../models/adminModel');
const authenticateToken = require('../middlewares/auth');
const cloudinary = require('../cloudinaryConfig');
const router = express.Router();

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper function for Cloudinary upload
const uploadImageToCloudinary = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "image", folder: "learning" }, // Organize images in a specific folder
            (error, result) => {
                if (error) return reject(error);
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
    const user = await Admin.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'Admin not found' });
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
            const result = await uploadImageToCloudinary(req.file.buffer);
            updates.profileImage = result.secure_url; // Store the image URL
        }

        // Update user in the database
        const updatedUser = await Admin.findByIdAndUpdate(req.user.userId, updates, { new: true });
        if (!updatedUser) return res.status(404).json({ message: 'Admin not found' });

        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
