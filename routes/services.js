const express = require('express');
const multer = require('multer');
const Service = require('../models/serviceModel');
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

router.post('/', upload.single('imageUrl'), async (req, res) => {
  try {
    // Log the request body and file to debug
    console.log('Request Body:', req.body);
    console.log('Uploaded File:', req.file);

    // Extract serviceOwnerId and other fields from the request body
    const { serviceOwnerId, serviceName, category, description, price, availability } = req.body;

    if (!serviceOwnerId) {
      return res.status(400).json({ message: 'Service owner ID is required.' });
    }

    // Create a new service object
    const product = new Service({
      serviceOwnerId, // Ensure the serviceOwnerId is saved
      serviceName,
      category,
      description,
      price,
      availability,
    });

    // Handle image upload if a file is provided
    if (req.file) {
      const result = await uploadImageToCloudinary(req.file.buffer);
      product.imageUrl = result.secure_url; // Store the image URL
    }

    // Save the service to the database
    const newProduct = await product.save();
    res.status(201).json({ message: 'Service created successfully', service: newProduct });
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ message: 'Error creating service', error: err.message });
  }
});

// Get Services
router.get('/', async (req, res) => {
  try {
    const services = await Service.find();
    res.json(services);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update Service
router.put('/:id', async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(service);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete Service
router.delete('/:id', async (req, res) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: 'Service deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

