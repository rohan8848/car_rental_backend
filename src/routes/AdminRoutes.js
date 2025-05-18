const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const Admin = require('../models/Admin');
const Driver = require('../models/Driver');  // Add Driver model import
const auth = require('../middleware/auth');
const nodemailer = require('nodemailer');
const upload = require('../middleware/upload');  // For handling file uploads
const path = require('path');
const fs = require('fs');

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Store OTPs temporarily
const otpStore = {};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email with better error handling
const sendOTPEmail = async (email, otp, isRegistration = true) => {
  // Create reusable transporter with better error handling
  const transporterConfig = {
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-default-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-default-app-password'
    }
  };
  
  console.log("Using email config:", {
    service: 'gmail',
    user: transporterConfig.auth.user
  });
  
  const transporter = nodemailer.createTransport(transporterConfig);
  
  // Verify connection configuration
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    // Continue anyway to see specific sending errors
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-default-email@gmail.com',
    to: email,
    subject: isRegistration ? 'Admin Registration OTP' : 'Admin Login OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3B82F6; text-align: center;">Car Rental Admin Verification</h2>
        <p>Hello,</p>
        <p>Your OTP code for ${isRegistration ? 'registration' : 'login'} is:</p>
        <div style="text-align: center; padding: 10px; background-color: #f8f9fa; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px; text-align: center;">
          Car Rental Service - Admin Portal
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Ensure directory exists for driver documents
const ensureDriverUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

// Call this function when the module loads
ensureDriverUploadsDir();

// Create admin with OTP verification - Step 1: Request OTP
router.post('/request-otp', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Log the request for debugging
    console.log("OTP Request received:", { username, email });
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Always send to imrajesh2005@gmail.com as requested
    const targetEmail = 'imrajesh2005@gmail.com';
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin already exists'
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    otpStore[username] = {
      otp,
      email: targetEmail,
      createdAt: new Date(),
      password: req.body.password  // Store temporarily for step 2
    };

    console.log("Generated OTP:", otp); 
    console.log("Email setup:", { 
      user: process.env.EMAIL_USER,
      hasPassword: !!process.env.EMAIL_PASS
    });

    try {
      // Send OTP email
      await sendOTPEmail(targetEmail, otp);
      console.log("OTP email sent successfully");
      
      res.status(200).json({
        success: true,
        message: 'OTP sent to email for verification'
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      
      // Return success even if email fails in development
      // In production, you might want to handle this differently
      res.status(200).json({
        success: true,
        message: 'OTP generated (email sending failed, check console)',
        devNote: 'OTP: ' + otp  // Only include in development
      });
    }
  } catch (error) {
    console.error('Error in OTP generation:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create admin with OTP verification - Step 2: Verify OTP and Create Admin
router.post('/create', async (req, res) => {
  const { username, otp } = req.body;

  try {
    const storedData = otpStore[username];
    
    // Validate OTP
    if (!storedData || storedData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Check if OTP is expired (10 minutes)
    const now = new Date();
    const otpCreationTime = new Date(storedData.createdAt);
    if ((now - otpCreationTime) > 10 * 60 * 1000) {
      delete otpStore[username];
      return res.status(400).json({
        success: false,
        message: 'OTP expired'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(storedData.password, 10);

    // Create new admin
    const newAdmin = new Admin({
      username,
      password: hashedPassword,
      email: storedData.email
    });

    await newAdmin.save();
    
    // Clear OTP data
    delete otpStore[username];

    res.status(201).json({
      success: true,
      message: 'Admin created successfully'
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Login with OTP verification - Step 1: Request OTP
router.post('/login-request-otp', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    
    if (!admin) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid login credentials' 
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid login credentials' 
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    otpStore[username] = {
      otp,
      email: 'imrajesh2005@gmail.com', // Always send to this email
      createdAt: new Date(),
      adminId: admin._id
    };

    // Send OTP email
    await sendOTPEmail('imrajesh2005@gmail.com', otp, false);

    res.json({
      success: true,
      message: 'OTP sent to email for verification',
      requireOTP: true
    });
  } catch (error) {
    console.error('Login OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Login with OTP verification - Step 2: Verify OTP and login
router.post('/login', async (req, res) => {
  try {
    const { username, password, otp } = req.body;
    
    console.log(`Admin login attempt for ${username} with OTP: ${otp ? 'provided' : 'not provided'}`);
    
    // If OTP is provided, verify it
    if (otp) {
      const storedData = otpStore[username];
      
      if (!storedData || storedData.otp !== otp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP'
        });
      }

      // Check if OTP is expired (10 minutes)
      const now = new Date();
      const otpCreationTime = new Date(storedData.createdAt);
      if ((now - otpCreationTime) > 10 * 60 * 1000) {
        delete otpStore[username];
        return res.status(400).json({
          success: false,
          message: 'OTP expired'
        });
      }

      // Create token with longer expiry (7 days)
      const token = jwt.sign(
        { _id: storedData.adminId },  // Use _id instead of id for consistency
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Clear OTP data
      delete otpStore[username];

      console.log(`Admin login successful for ${username} with OTP, token created`);
      return res.json({
        success: true,
        token,
        message: 'Login successful'
      });
    }
    
    // If no OTP provided, start OTP process
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid login credentials' 
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid login credentials' 
      });
    }

    // Generate OTP for login
    const loginOtp = generateOTP();
    otpStore[username] = {
      otp: loginOtp,
      email: 'imrajesh2005@gmail.com', // Always send to this email
      createdAt: new Date(),
      adminId: admin._id
    };

    // Send OTP email
    await sendOTPEmail('imrajesh2005@gmail.com', loginOtp, false);

    res.json({
      success: true,
      message: 'OTP sent to email for verification',
      requireOTP: true
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Invalid login credentials' 
    });
  }
});

// Protected admin dashboard route
router.get('/dashboard', auth, async (req, res) => {
  try {
    console.log('Admin dashboard request received');
    
    // Fetch all required data in parallel with complete car details
    const [users, cars, bookings] = await Promise.all([
      User.find().select('-password'),
      Car.find(),
      Booking.find()
        .populate({
          path: 'user', 
          select: 'name email'
        })
        .populate({
          path: 'car', 
          select: 'name title brand type price images'
        })
        .sort({ createdAt: -1 })
        .limit(20)
    ]);
    
    console.log(`Dashboard data: ${users.length} users, ${cars.length} cars, ${bookings.length} bookings`);

    // Process bookings to handle any with missing car data
    const processedBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      
      // Add fallback for missing car data
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

    // Calculate statistics
    const totalRevenue = processedBookings.reduce((acc, booking) => {
      return booking.status === 'completed' ? acc + (booking.totalAmount || 0) : acc;
    }, 0);

    const recentBookings = processedBookings.slice(0, 5); // Take up to 5 most recent

    const activeUsers = users.filter(user => !user.isBlocked).length;
    const availableCars = cars.filter(car => car.status === 'available').length;

    // Calculate booking statistics
    const bookingStats = {
      pending: processedBookings.filter(b => b.status === 'pending').length,
      confirmed: processedBookings.filter(b => b.status === 'confirmed').length,
      completed: processedBookings.filter(b => b.status === 'completed').length,
      cancelled: processedBookings.filter(b => b.status === 'cancelled').length,
      total: processedBookings.length
    };

    console.log('Dashboard data processed successfully');

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers: users.length,
          activeUsers,
          totalCars: cars.length,
          availableCars,
          totalBookings: processedBookings.length,
          totalRevenue,
          bookingStats
        },
        recentBookings: recentBookings.map(booking => ({
          _id: booking._id,
          user: {
            name: booking.user?.name || 'Unknown',
            email: booking.user?.email || 'unknown@example.com'
          },
          car: {
            name: booking.car?.name || 'Unavailable Car',
            title: booking.car?.title || booking.car?.name || 'Unavailable Car',
            brand: booking.car?.brand || 'Unknown',
            price: booking.car?.price || 0
          },
          startDate: booking.startDate,
          endDate: booking.endDate,
          status: booking.status || 'pending',
          totalAmount: booking.totalAmount || 0,
          createdAt: booking.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard data',
      error: error.message
    });
  }
});

// Check admin authentication
router.get('/check-auth', auth, (req, res) => {
  console.log('Admin check-auth successful for:', req.user._id);
  res.json({ 
    success: true, 
    message: 'Authenticated',
    user: {
      _id: req.user._id,
      username: req.user.username
    }
  });
});

// Admin endpoint to get all bookings
router.get('/bookings', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: Admin only' 
      });
    }
    
    console.log("Admin requesting all bookings");
    
    const bookings = await Booking.find()
      .populate('user', 'name email phone')
      .populate('car', 'name title brand type transmission fuel price images status')
      .populate('driver', 'name phone email experience profileImage licenseNumber status')
      .sort({ createdAt: -1 });
      
    // Add fallbacks for any bookings with missing car data and fix driver data
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
      
      // Process driver data if present
      if (bookingObj.driverAssigned && bookingObj.driver) {
        // Fix driver image paths and add default values
        bookingObj.driver = {
          ...bookingObj.driver,
          name: bookingObj.driver.name || "Driver Name Unavailable",
          experience: bookingObj.driver.experience || "0",
          phone: bookingObj.driver.phone || "Not Available",
          email: bookingObj.driver.email || "Not Available",
          // Fix profileImage path if it exists
          profileImage: bookingObj.driver.profileImage ? 
            (bookingObj.driver.profileImage.includes('/drivers/') ? 
              `/uploads/${bookingObj.driver.profileImage.split('/').pop()}` : 
              bookingObj.driver.profileImage) : 
            null
        };
      }
      
      return bookingObj;
    });
    
    console.log(`Found ${processedBookings.length} bookings`);
    
    res.json({
      success: true,
      data: processedBookings
    });
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Admin endpoint to update booking status
router.put('/bookings/:id/status', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: Admin only' 
      });
    }
    
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const booking = await Booking.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Admin endpoint to delete booking
router.delete('/bookings/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied: Admin only' 
      });
    }
    
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all drivers (admin only)
router.get('/drivers', auth, async (req, res) => {
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

// Get driver by ID (admin only)
router.get('/drivers/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    console.log(`Fetching driver with ID: ${req.params.id}`);
    
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
      console.log(`Driver with ID ${req.params.id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Process driver data to fix image paths and add default values
    const processedDriver = {
      ...driver.toObject(),
      name: driver.name || "Driver Name Unavailable",
      experience: driver.experience || "0",
      phone: driver.phone || "Not Available",
      email: driver.email || "Not Available", 
      licenseNumber: driver.licenseNumber || "Not Available",
      // Fix profileImage path - remove /drivers/
      profileImage: driver.profileImage ? 
        (driver.profileImage.includes('/drivers/') ? 
          `/uploads/${driver.profileImage.split('/').pop()}` : 
          driver.profileImage) : 
        null,
      // Fix licenseImage path - remove /drivers/
      licenseImage: driver.licenseImage ? 
        (driver.licenseImage.includes('/drivers/') ? 
          `/uploads/${driver.licenseImage.split('/').pop()}` : 
          driver.licenseImage) : 
        null
    };

    console.log('Driver data processed:', {
      id: processedDriver._id,
      name: processedDriver.name,
      experience: processedDriver.experience,
      profileImage: processedDriver.profileImage
    });

    res.json({
      success: true,
      data: processedDriver
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

// Create new driver (admin only)
router.post('/drivers', auth, upload.fields([
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

    // Add image paths if provided - WITHOUT the drivers subdirectory
    if (req.files && req.files.licenseImage) {
      newDriver.licenseImage = `/uploads/${req.files.licenseImage[0].filename}`;
    }

    if (req.files && req.files.profileImage) {
      newDriver.profileImage = `/uploads/${req.files.profileImage[0].filename}`;
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
router.put('/drivers/:id', auth, upload.fields([
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
        driver.licenseImage = `/uploads/${req.files.licenseImage[0].filename}`;
      }

      if (req.files.profileImage) {
        // Delete old profile image if it exists
        if (driver.profileImage) {
          const oldPath = path.join(__dirname, '../../', driver.profileImage);
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        }
        driver.profileImage = `/uploads/${req.files.profileImage[0].filename}`;
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
router.delete('/drivers/:id', auth, async (req, res) => {
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
router.post('/drivers/assign', auth, async (req, res) => {
  try {
    console.log('Assign driver request by user:', req.user);
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { driverId, bookingId } = req.body;

    if (!driverId || !bookingId) {
      return res.status(400).json({
        success: false, 
        message: 'Driver ID and Booking ID are required'
      });
    }

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
router.post('/drivers/complete-assignment', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    const { driverId } = req.body;
    
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required'
      });
    }

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

// Get available drivers (admin only)
router.get('/available-drivers', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

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

module.exports = router;
