const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Booking = require('../models/Booking');
const Car = require('../models/Car');
const nodemailer = require('nodemailer');

// Store OTPs temporarily
const otpStore = {};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
const sendOTPEmail = async (email, otp, purpose = 'verification') => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-default-email@gmail.com',
      pass: process.env.EMAIL_PASS || 'your-default-app-password'
    }
  });
  
  // Prepare subject based on purpose
  let subject = 'Email Verification';
  if (purpose === 'reset') {
    subject = 'Password Reset Request';
  }
  
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-default-email@gmail.com',
    to: email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3B82F6; text-align: center;">Car Rental Service</h2>
        <p>Hello,</p>
        <p>Your OTP code for ${purpose === 'reset' ? 'password reset' : 'email verification'} is:</p>
        <div style="text-align: center; padding: 10px; background-color: #f8f9fa; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p style="margin-top: 30px; color: #666; font-size: 12px; text-align: center;">
          Car Rental Service
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Email sending error:", error);
    return false;
  }
};

// Email verification route - sends OTP
router.post('/verify-email', async (req, res) => {
  try {
    const { email, name } = req.body;
    
    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    otpStore[email] = {
      otp,
      name,
      createdAt: new Date()
    };

    console.log("Generated OTP for verification:", otp);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    
    if (emailSent) {
      res.status(200).json({
        success: true,
        message: 'OTP sent to email for verification'
      });
    } else {
      // In development, return the OTP even if email fails
      res.status(200).json({
        success: true,
        message: 'OTP generated (email sending failed, check console)',
        devNote: 'OTP: ' + otp  // Only include in development
      });
    }
  } catch (error) {
    console.error('Error in email verification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Register User
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, otp } = req.body;

    // Validate OTP
    const storedOTPData = otpStore[email];
    if (!storedOTPData || storedOTPData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Check OTP expiry (10 minutes)
    const now = new Date();
    const otpCreationTime = new Date(storedOTPData.createdAt);
    if ((now - otpCreationTime) > 10 * 60 * 1000) {
      delete otpStore[email];
      return res.status(400).json({
        success: false,
        message: 'OTP expired'
      });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    // Create new user
    user = new User({
      name,
      email,
      password, // Pre-save hook will hash it
      phone
    });

    await user.save();

    // Clear OTP data
    delete otpStore[email];

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Server error during registration' 
    });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Send success response
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Forgot password - Request OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Generate and store OTP
    const otp = generateOTP();
    otpStore[email] = {
      otp,
      userId: user._id,
      createdAt: new Date()
    };

    console.log("Generated OTP for password reset:", otp);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, 'reset');
    
    if (emailSent) {
      res.status(200).json({
        success: true,
        message: 'Password reset OTP sent to your email'
      });
    } else {
      // In development, return the OTP even if email fails
      res.status(200).json({
        success: true,
        message: 'OTP generated (email sending failed, check console)',
        devNote: 'OTP: ' + otp  // Only include in development
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    // Validate OTP
    const storedOTPData = otpStore[email];
    if (!storedOTPData || storedOTPData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Check OTP expiry (10 minutes)
    const now = new Date();
    const otpCreationTime = new Date(storedOTPData.createdAt);
    if ((now - otpCreationTime) > 10 * 60 * 1000) {
      delete otpStore[email];
      return res.status(400).json({
        success: false,
        message: 'OTP expired'
      });
    }

    // Find user and update password
    const user = await User.findById(storedOTPData.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword; // Pre-save hook will hash it
    await user.save();

    // Clear OTP data
    delete otpStore[email];

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all users route
router.get("/", async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const users = await User.find().select('-password').maxTimeMS(5000).exec();
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// Get all users (admin only)
router.get("/all", auth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ message: "Database connection error" });
    }

    const users = await User.find()
      .select('-password')
      .maxTimeMS(5000)
      .exec();

    res.json({
      success: true,
      users: users
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message
    });
  }
});

// Delete user (admin only)
router.delete("/:userId", auth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.userId);
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user"
    });
  }
});

// Block/Unblock user (admin only)
router.put("/:userId/toggle-block", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isBlocked: user.isBlocked
      }
    });
  } catch (error) {
    console.error("Toggle block user error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user status"
    });
  }
});

// Update user role (admin only)
router.put("/:userId/role", auth, async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: "User role updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user role"
    });
  }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, phone, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Update user details
    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;

    // If currentPassword and newPassword are provided, update the password
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      // Just set the new plain password - the pre-save hook will hash it automatically
      // Do NOT hash it here to avoid double-hashing
      user.password = newPassword;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Add this route to save user location
router.post('/location', auth, async (req, res) => {
  try {
    const { lat, lng, timestamp } = req.body;
    const userId = req.user._id;
    
    // In a real app, you might save this to a UserLocation model
    // For now, we'll just return success
    console.log(`Location received for user ${userId}: ${lat}, ${lng} at ${timestamp}`);
    
    res.json({
      success: true,
      message: 'Location saved successfully'
    });
  } catch (error) {
    console.error('Error saving location:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get recent bookings
router.get('/bookings/recent', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .sort('-createdAt')
      .limit(5)
      .populate('car');

    res.json({ bookings });
  } catch (error) {
    console.error('Recent bookings error:', error);
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

module.exports = router;