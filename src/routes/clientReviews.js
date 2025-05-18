const express = require('express');
const router = express.Router();
const ClientReview = require('../models/ClientReview');
const auth = require('../middleware/auth');
const upload = require('../config/multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory at:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

// Call this function when the module loads
ensureUploadsDir();

// Get all active client reviews (public)
router.get('/public', async (req, res) => {
  try {
    const reviews = await ClientReview.find({ isActive: true })
                                       .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching client reviews:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get all client reviews (admin only)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const reviews = await ClientReview.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    console.error('Error fetching client reviews:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Add a new client review (admin only)
router.post('/', auth, upload.single('logo'), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    console.log('Received review post request:', req.body);
    console.log('Uploaded file:', req.file);
    
    const { name, review, rating } = req.body;
    
    if (!name || !review || !rating) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, review and rating are required' 
      });
    }
    
    const newReview = new ClientReview({
      name,
      review,
      rating: Number(rating)
    });
    
    // If logo was uploaded
    if (req.file) {
      // Fix the path to not include 'src/' - just use '/uploads/'
      newReview.logo = `/uploads/${req.file.filename}`;
      console.log('Logo saved with path:', newReview.logo);
    }
    
    await newReview.save();
    
    res.status(201).json({
      success: true,
      message: 'Client review added successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error adding client review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update a client review (admin only)
router.put('/:id', auth, upload.single('logo'), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    console.log('Received review update request:', req.body);
    console.log('Uploaded file:', req.file);
    
    const { name, review, rating, isActive } = req.body;
    
    const clientReview = await ClientReview.findById(req.params.id);
    
    if (!clientReview) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client review not found' 
      });
    }
    
    // Update fields
    if (name) clientReview.name = name;
    if (review) clientReview.review = review;
    if (rating) clientReview.rating = Number(rating);
    if (isActive !== undefined) clientReview.isActive = isActive === 'true' || isActive === true;
    
    // If logo was uploaded, update it and remove old one if it exists
    if (req.file) {
      // If there's an existing logo that's not an external URL, try to remove it
      if (clientReview.logo && 
          !clientReview.logo.startsWith('http://') && 
          !clientReview.logo.startsWith('https://')) {
        try {
          // Extract filename from path, removing any potential 'src' prefix
          const oldFilename = clientReview.logo.split('/').pop();
          const oldFilePath = path.join(__dirname, '../../uploads', oldFilename);
          
          // Check if file exists before attempting to delete
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log('Previous logo deleted:', oldFilePath);
          }
        } catch (err) {
          console.error('Error removing old logo file:', err);
          // Continue even if old file deletion fails
        }
      }
      
      // Fix the path to not include 'src/' - just use '/uploads/'
      clientReview.logo = `/uploads/${req.file.filename}`;
      console.log('Updated logo path:', clientReview.logo);
    }
    
    await clientReview.save();
    
    res.json({
      success: true,
      message: 'Client review updated successfully',
      data: clientReview
    });
  } catch (error) {
    console.error('Error updating client review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Toggle active status (admin only)
router.put('/:id/toggle', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const clientReview = await ClientReview.findById(req.params.id);
    
    if (!clientReview) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client review not found' 
      });
    }
    
    clientReview.isActive = !clientReview.isActive;
    
    await clientReview.save();
    
    res.json({
      success: true,
      message: `Client review ${clientReview.isActive ? 'activated' : 'deactivated'} successfully`,
      data: clientReview
    });
  } catch (error) {
    console.error('Error toggling client review status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Delete a client review (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const clientReview = await ClientReview.findById(req.params.id);
    
    if (!clientReview) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client review not found' 
      });
    }
    
    await ClientReview.deleteOne({ _id: req.params.id });
    
    res.json({
      success: true,
      message: 'Client review deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client review:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;
