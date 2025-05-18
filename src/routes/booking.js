const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Get user's bookings
router.get('/user', auth, async (req, res) => {
  try {
    console.log('Fetching bookings for user:', req.user._id);
    
    const bookings = await Booking.find({ user: req.user._id })
      .populate('car')
      .populate({
        path: 'driver',
        select: 'name phone email experience profileImage licenseNumber licenseImage status dateOfBirth address'
      })
      .sort({ createdAt: -1 });
    
    // Process bookings to ensure driver data is properly formatted
    const processedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      // If driver is assigned, ensure data is complete
      if (bookingObj.driverAssigned && bookingObj.driver) {
        console.log(`Processing driver for booking ${booking._id}:`, booking.driver._id);
        
        // Get the original profile image path without directory modifications
        let profileImagePath = bookingObj.driver.profileImage;
        if (profileImagePath && profileImagePath.includes('/drivers/')) {
          // Extract just the filename from the path
          const fileName = profileImagePath.split('/').pop();
          // Use direct path without drivers subdirectory
          profileImagePath = `/uploads/${fileName}`;
        }
        
        // Get the original license image path without directory modifications
        let licenseImagePath = bookingObj.driver.licenseImage;
        if (licenseImagePath && licenseImagePath.includes('/drivers/')) {
          // Extract just the filename from the path
          const fileName = licenseImagePath.split('/').pop();
          // Use direct path without drivers subdirectory
          licenseImagePath = `/uploads/${fileName}`;
        }
        
        // Ensure driver has all required fields with defaults
        bookingObj.driver = {
          ...bookingObj.driver,
          name: bookingObj.driver.name || "Driver Name Unavailable",
          experience: bookingObj.driver.experience || "0",
          phone: bookingObj.driver.phone || "Not Available",
          email: bookingObj.driver.email || "Not Available",
          
          // Use the fixed profile and license image paths
          profileImage: profileImagePath,
          licenseImage: licenseImagePath,
          
          // Add the rating from driver model if available
          rating: bookingObj.driver.rating || 0,
          
          // Include reviews if available
          reviews: bookingObj.driver.reviews || []
        };
      }
      
      return bookingObj;
    });
    
    res.json(processedBookings);
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new booking
router.post('/', auth, async (req, res) => {
  try {
    const { 
      car, startDate, endDate, address, email, contact, totalAmount, 
      location, pickupCoords, dropoffCoords, pickupAddress, dropoffAddress,
      needsDriver, driverPrice
    } = req.body;
    
    // Validate required fields
    if (!car || !startDate || !endDate || !totalAmount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: car, startDate, endDate, or totalAmount' 
      });
    }
    
    // Validate either location or pickup/dropoff coordinates
    if (!location && (!pickupCoords || !dropoffCoords)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing location information' 
      });
    }
    
    // Validate existence of the car
    const foundCar = await Car.findById(car);
    if (!foundCar) {
      return res.status(404).json({ success: false, message: "Car not found" });
    }
    
    const booking = new Booking({
      user: req.user._id,
      car,
      startDate,
      endDate,
      address,
      email,
      contact,
      totalAmount,
      needsDriver: needsDriver || false,
      driverPrice: driverPrice || 0,
      status: "pending"
    });

    // Add location fields based on booking type
    if (location) {
      booking.location = location;
      booking.hasSeparateLocations = false;
    } else {
      booking.pickupCoords = pickupCoords;
      booking.dropoffCoords = dropoffCoords;
      booking.pickupAddress = pickupAddress || 'Pickup location';
      booking.dropoffAddress = dropoffAddress || 'Dropoff location';
      booking.hasSeparateLocations = true;
    }

    await booking.save();
    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error("Booking creation error:", error);
    console.error("Error details:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// Cancel booking
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Cannot cancel this booking' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.json(booking);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all bookings - enhanced for admin access
router.get('/', auth, async (req, res) => {
  try {
    // Determine if it's an admin request
    const isAdminRequest = req.user.isAdmin === true;
    
    console.log(`Bookings request from: ${isAdminRequest ? 'Admin' : 'User'} ID: ${req.user._id}`);
    
    let query = {};
    
    // If it's a regular user, restrict to their own bookings
    if (!isAdminRequest) {
      query.user = req.user._id;
    }

    // Enhanced populate to ensure car data is complete
    const bookings = await Booking.find(query)
      .populate({
        path: 'user',
        select: 'name email phone'
      })
      .populate({
        path: 'car',
        select: 'name title brand type transmission fuel price images status'
      })
      .sort({ createdAt: -1 });

    // Add fallbacks for any bookings with missing car data
    const processedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      // Check if car data is missing and provide fallback
      if (!bookingObj.car) {
        bookingObj.car = {
          name: "Unavailable Car",
          title: "Car information unavailable",
          brand: "Unknown",
          price: 0,
          images: []
        };
      }
      
      return bookingObj;
    });

    res.json({ success: true, data: processedBookings });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update booking status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send confirmation email
router.post('/:id/send-confirmation', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('user').populate('car');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Configure nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: booking.user.email,
      subject: 'Booking Confirmation',
      text: `Dear ${booking.user.name},\n\nYour booking for ${booking.car.name} has been confirmed.\n\nBooking Details:\nStart Date: ${booking.startDate}\nEnd Date: ${booking.endDate}\n\nThank you for choosing our service.\n\nBest regards,\nCar Rental Team`
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Confirmation email sent' });
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// New: Get single booking by id
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('car');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;