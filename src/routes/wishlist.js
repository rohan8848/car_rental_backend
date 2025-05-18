const express = require('express');
const router = express.Router();
const Wishlist = require('../models/Wishlist');
const auth = require('../middleware/auth');

// Get user's wishlist
router.get('/', auth, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user: req.user._id }).populate('car');
    res.json({ wishlist });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add car to wishlist
router.post('/', auth, async (req, res) => {
  try {
    const { carId } = req.body;
    const wishlistItem = new Wishlist({ user: req.user._id, car: carId });
    await wishlistItem.save();
    res.status(201).json({ message: 'Car added to wishlist' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove car from wishlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await Wishlist.findOneAndDelete({ user: req.user._id, car: id });
    res.json({ message: 'Car removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
