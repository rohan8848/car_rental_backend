const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');

// Get all reviews
router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('car')
      .populate('user', 'name')
      .sort('-createdAt');

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews'
    });
  }
});

// Get user's reviews
router.get('/user', auth, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user.id })
      .populate('car')
      .populate('user', 'name')
      .sort('-createdAt');

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews'
    });
  }
});

// Get reviews for a specific car
router.get('/car/:carId', async (req, res) => {
  try {
    const reviews = await Review.find({ car: req.params.carId })
      .populate('user', 'name')
      .sort('-createdAt');

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews'
    });
  }
});

// Search reviews by reviewer name or car name
router.get('/search', async (req, res) => {
  try {
    const { term, type } = req.query;
    const searchField = type === 'user' ? 'user' : 'car';
    const reviews = await Review.find()
      .populate({
        path: searchField,
        match: { name: { $regex: term, $options: 'i' } }
      })
      .populate('user', 'name')
      .sort('-createdAt');

    // Filter out reviews with no matching car or user
    const filteredReviews = reviews.filter(review => review.car && review.user);

    res.json({
      success: true,
      reviews: filteredReviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error searching reviews'
    });
  }
});

// Add new review
router.post('/car/:carId/reviews', auth, async (req, res) => {
  try {
    const { carId } = req.params;
    const { rating, comment } = req.body;

    // Check if the user has completed a booking for this car
    const booking = await Booking.findOne({ car: carId, user: req.user._id, status: 'completed' });
    if (!booking) {
      return res.status(400).json({ message: 'You can only review cars you have booked and completed.' });
    }

    const review = new Review({
      car: carId,
      user: req.user._id,
      rating,
      comment,
    });
    await review.save();
    await review.populate('user', 'name'); // Populate user information
    res.status(201).json({ message: 'Review added', review });
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new review for a driver
router.post('/driver/:driverId', auth, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || !comment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating and comment are required' 
      });
    }

    const Driver = require('../models/Driver'); // Import Driver model
    
    // Find the driver
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check if user has had this driver in a completed booking
    const Booking = await require('../models/Booking');
    const hasCompletedBooking = await Booking.findOne({
      user: req.user._id,
      driver: driverId,
      status: 'completed'
    });

    // Add review to driver's reviews array
    const newReview = {
      user: req.user._id,
      rating: Number(rating),
      comment,
      date: new Date()
    };

    // Initialize reviews array if it doesn't exist
    if (!driver.reviews) {
      driver.reviews = [];
    }
    
    driver.reviews.push(newReview);

    // Calculate new average rating
    const avgRating = driver.reviews.reduce((acc, rev) => acc + rev.rating, 0) / driver.reviews.length;
    driver.rating = avgRating;

    await driver.save();

    res.status(201).json({
      success: true,
      message: 'Driver review submitted successfully',
      data: newReview
    });
  } catch (error) {
    console.error('Error submitting driver review:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Check if user can review a car
router.get('/car/:carId/can-review', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const carId = req.params.carId;

    // Check if user has a completed booking for this car
    const completedBooking = await Booking.findOne({
      user: userId,
      car: carId,
      status: 'completed'
    });

    const canReview = !!completedBooking;

    res.json({
      success: true,
      canReview,
      message: canReview ? 
        'User can review this car' : 
        'You can only review cars you have booked and completed.'
    });
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking review eligibility'
    });
  }
});

// Update review
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findByIdAndUpdate(
      id,
      { rating, comment },
      { new: true }
    ).populate('user', 'name');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review updated', review });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete review
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
