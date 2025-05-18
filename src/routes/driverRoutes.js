const express = require('express');
const router = express.Router();
const Driver = require('../models/Driver');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// Ensure directory exists for driver documents
const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../uploads/drivers');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

// Call this function when the module loads
ensureUploadsDir();

// Get all drivers (admin only)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const drivers = await Driver.find()
      .populate('currentBooking')
      .sort('-createdAt');

    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching drivers',
      error: error.message
    });
  }
});

// Get available drivers (admin only)
router.get('/available', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { startDate, endDate } = req.query;
    
    // Find drivers with 'available' status
    const availableDrivers = await Driver.find({ 
      status: 'available',
      isActive: true
    });

    res.json({
      success: true,
      count: availableDrivers.length,
      data: availableDrivers
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available drivers',
      error: error.message
    });
  }
});

// Get single driver (admin only)
router.get('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const driver = await Driver.findById(req.params.id)
      .populate('currentBooking')
      .populate({
        path: 'bookingHistory.booking',
        populate: {
          path: 'car user',
          select: 'name brand type email'
        }
      });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching driver',
      error: error.message
    });
  }
});

// Add new driver (admin only)
router.post('/', auth, upload.fields([
  { name: 'licenseImage', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const {
      name,
      licenseNumber,
      phone,
      email,
      address,
      dateOfBirth,
      experience
    } = req.body;

    // Validate required fields
    if (!name || !licenseNumber || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if driver with same license number already exists
    const existingDriver = await Driver.findOne({ licenseNumber });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Driver with this license number already exists'
      });
    }

    // Create new driver object
    const newDriver = new Driver({
      name,
      licenseNumber,
      phone,
      email,
      address,
      dateOfBirth,
      experience: parseInt(experience) || 0
    });

    // Add image paths if provided
    if (req.files.licenseImage) {
      newDriver.licenseImage = `/uploads/drivers/${req.files.licenseImage[0].filename}`;
    }

    if (req.files.profileImage) {
      newDriver.profileImage = `/uploads/drivers/${req.files.profileImage[0].filename}`;
    }

    // Save the driver
    await newDriver.save();

    res.status(201).json({
      success: true,
      message: 'Driver added successfully',
      data: newDriver
    });
  } catch (error) {
    console.error('Error adding driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding driver',
      error: error.message
    });
  }
});

// Update driver (admin only)
router.put('/:id', auth, upload.fields([
  { name: 'licenseImage', maxCount: 1 },
  { name: 'profileImage', maxCount: 1 }
]), async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Update driver fields
    const fields = [
      'name', 'licenseNumber', 'phone', 'email',
      'address', 'dateOfBirth', 'experience', 'status'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        driver[field] = req.body[field];
      }
    });

    // Handle uploaded images
    if (req.files) {
      if (req.files.licenseImage) {
        // Delete old license image if it exists
        if (driver.licenseImage) {
          const oldPath = path.join(__dirname, '../../', driver.licenseImage);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        driver.licenseImage = `/uploads/drivers/${req.files.licenseImage[0].filename}`;
      }

      if (req.files.profileImage) {
        // Delete old profile image if it exists
        if (driver.profileImage) {
          const oldPath = path.join(__dirname, '../../', driver.profileImage);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        driver.profileImage = `/uploads/drivers/${req.files.profileImage[0].filename}`;
      }
    }

    await driver.save();

    res.json({
      success: true,
      message: 'Driver updated successfully',
      data: driver
    });
  } catch (error) {
    console.error('Error updating driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating driver',
      error: error.message
    });
  }
});

// Delete driver (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const driver = await Driver.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if driver is currently assigned
    if (driver.status === 'assigned' && driver.currentBooking) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete driver with active booking'
      });
    }

    // Delete driver images
    if (driver.licenseImage) {
      const licPath = path.join(__dirname, '../../', driver.licenseImage);
      if (fs.existsSync(licPath)) {
        fs.unlinkSync(licPath);
      }
    }

    if (driver.profileImage) {
      const profPath = path.join(__dirname, '../../', driver.profileImage);
      if (fs.existsSync(profPath)) {
        fs.unlinkSync(profPath);
      }
    }

    await Driver.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting driver',
      error: error.message
    });
  }
});

// Assign driver to booking (admin only)
router.put('/assign/:driverId/:bookingId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { driverId, bookingId } = req.params;

    // Get the driver and booking
    const driver = await Driver.findById(driverId);
    const booking = await Booking.findById(bookingId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check driver availability
    if (driver.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Driver is not available'
      });
    }

    // Update driver status and current booking
    driver.status = 'assigned';
    driver.currentBooking = bookingId;
    driver.bookingHistory.push({
      booking: bookingId,
      assignedAt: new Date()
    });

    // Update booking with driver info
    booking.driver = driverId;
    booking.driverAssigned = true;

    // Save both documents
    await Promise.all([driver.save(), booking.save()]);

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      data: {
        driver,
        booking
      }
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning driver',
      error: error.message
    });
  }
});

// Complete driver assignment (admin only)
router.put('/complete-assignment/:driverId', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { driverId } = req.params;
    const driver = await Driver.findById(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    if (driver.status !== 'assigned' || !driver.currentBooking) {
      return res.status(400).json({
        success: false,
        message: 'Driver is not currently assigned to any booking'
      });
    }

    // Find the current booking entry in history
    const currentBookingEntry = driver.bookingHistory.find(
      entry => entry.booking.toString() === driver.currentBooking.toString() && !entry.completedAt
    );

    if (currentBookingEntry) {
      currentBookingEntry.completedAt = new Date();
    }

    // Reset driver status
    driver.status = 'available';
    driver.currentBooking = null;

    await driver.save();

    res.json({
      success: true,
      message: 'Driver assignment completed successfully',
      data: driver
    });
  } catch (error) {
    console.error('Error completing driver assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing driver assignment',
      error: error.message
    });
  }
});

// Update driver availability (admin only)
router.put('/:id/status', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Cannot change status if currently assigned to a booking
    if (driver.status === 'assigned' && driver.currentBooking && status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status while driver is assigned to a booking'
      });
    }

    driver.status = status;
    await driver.save();

    res.json({
      success: true,
      message: 'Driver status updated successfully',
      data: driver
    });
  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating driver status',
      error: error.message
    });
  }
});

// Add driver review (authenticated users only)
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if user has a completed booking with this driver
    const bookingHistory = driver.bookingHistory.map(hist => hist.booking);
    
    const userBookings = await Booking.find({
      _id: { $in: bookingHistory },
      user: req.user._id,
      status: 'completed'
    });

    if (userBookings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You can only review drivers after completing a ride with them'
      });
    }

    // Check if user already submitted a review
    const existingReviewIndex = driver.reviews.findIndex(
      review => review.user.toString() === req.user._id.toString()
    );

    if (existingReviewIndex !== -1) {
      // Update existing review
      driver.reviews[existingReviewIndex].rating = rating;
      driver.reviews[existingReviewIndex].comment = comment;
      driver.reviews[existingReviewIndex].date = new Date();
    } else {
      // Add new review
      driver.reviews.push({
        user: req.user._id,
        rating,
        comment,
        date: new Date()
      });
    }

    await driver.save();

    res.json({
      success: true,
      message: 'Review submitted successfully',
      data: driver.reviews
    });
  } catch (error) {
    console.error('Error submitting driver review:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting review',
      error: error.message
    });
  }
});

// Get all public driver reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .select('reviews rating name')
      .populate('reviews.user', 'name');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    res.json({
      success: true,
      data: {
        driverName: driver.name,
        rating: driver.rating,
        reviews: driver.reviews
      }
    });
  } catch (error) {
    console.error('Error getting driver reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting reviews',
      error: error.message
    });
  }
});

module.exports = router;
