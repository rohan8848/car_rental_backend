const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const auth = require('./middleware/auth');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Set up middleware properly - make sure this appears before the routes
app.use(express.json());
app.use(cors({
  origin: '*', // Configure according to your frontend URL in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add Content Security Policy headers to allow fonts and other resources
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy', 
    "default-src 'self'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*"
  );
  next();
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('Creating uploads directory at:', uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files from the root-level uploads directory
// This makes files accessible via /uploads/* URLs
app.use('/uploads', express.static(uploadsDir));

// Add a debug route to check if images are accessible
app.get('/check-uploads', (req, res) => {
  const uploadsPath = path.join(__dirname, '../uploads');
  fs.readdir(uploadsPath, (err, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error reading uploads directory',
        error: err.message,
        uploadsPath
      });
    }
    res.json({
      success: true, 
      uploadsDirectory: uploadsPath, 
      files,
      baseUrl: `${req.protocol}://${req.get('host')}/uploads` // Note the /uploads path
    });
  });
});

app.get('/', (req, res)=> {    
  res.send('Welcome to Car Rental API');  
});

// Database connection helper
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected Successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// Initialize DB connection
connectDB();

// Import routes
const carRoutes = require('./routes/CarRoutes');
const userRoutes = require('./routes/userAuth'); 
const AdminRoutes = require('./routes/AdminRoutes');
const bookingRoutes = require('./routes/booking');
const wishlistRoutes = require('./routes/wishlist');
const reviewRoutes = require('./routes/reviews');
const messageRoutes = require('./routes/messages');
const clientReviewRoutes = require('./routes/clientReviews');
const paymentRoutes = require('./routes/payment.routes'); // Add this line

// Use routes
app.use('/api/cars', carRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', AdminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/client-reviews', clientReviewRoutes);
app.use('/api/payment', paymentRoutes); // Add this line

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});
