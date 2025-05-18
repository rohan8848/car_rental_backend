const express = require('express');
const router = express.Router();
const Car = require('../models/Car');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Middleware to check if the value is a valid ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Get all cars
router.get('/', async (req, res) => {
  try {
    const cars = await Car.find().sort('-createdAt');
    res.json({
      success: true,
      data: cars.map(car => ({
        _id: car._id,
        name: car.name,
        brand: car.brand,
        type: car.type,
        transmission: car.transmission,
        fuel: car.fuel,
        seats: car.seats,
        price: car.price,
        mileage: car.mileage,
        description: car.description,
        images: car.images || [], // Ensure images is always an array
        status: car.status || 'unknown' // Ensure status is always defined
      }))
    });
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cars'
    });
  }
});

// Get car by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const car = await Car.findById(id);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    res.json({
      success: true,
      car: {
        ...car.toObject(),
        images: car.images || [], // Ensure images is always an array
        status: car.status || 'unknown' // Ensure status is always defined
      }
    });
  } catch (error) {
    console.error('Error fetching car:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Add new car (admin only)
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const { name, brand, type, transmission, fuel, seats, price, mileage, description } = req.body;

    // Get file paths
    const images = req.files.map(file => `/uploads/${file.filename}`);

    const car = new Car({
      name,
      brand,
      type,
      transmission,
      fuel,
      seats,
      price,
      mileage,
      description,
      images
    });

    await car.save();

    res.status(201).json({
      success: true,
      data: car
    });
  } catch (error) {
    console.error('Error adding car:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update car (admin only)
router.put('/:id', auth, upload.array('images', 5), async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    // Handle new images
    if (req.files?.length) {
      const newImages = req.files.map(file => `/uploads/${file.filename}`);
      
      // Delete old images
      car.images.forEach(imagePath => {
        const fullPath = path.join(__dirname, '../../', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      });

      car.images = newImages;
    }

    // Update other fields
    Object.keys(req.body).forEach(key => {
      car[key] = req.body[key];
    });

    await car.save();

    res.json({
      success: true,
      data: car
    });
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update car status (admin only)
router.put('/:id/status', auth, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    car.status = req.body.status;
    await car.save();

    res.json({
      success: true,
      data: car
    });
  } catch (error) {
    console.error('Error updating car status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete car (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }

    // Delete associated images
    car.images.forEach(imagePath => {
      const fullPath = path.join(__dirname, '../../', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    await car.deleteOne();

    res.json({
      success: true,
      message: 'Car deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Search cars by location
router.get('/cars/search/location', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.query;

    const cars = await Car.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      },
      status: 'available'
    });

    res.json(cars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route to get popular cars
router.get('/popular', async (req, res) => {
  try {
    const popularCars = await Car.find({ isPopular: true });
    res.json({
      success: true,
      data: popularCars.map(car => ({
        ...car.toObject(),
        images: car.images || [], // Ensure images is always an array
        status: car.status || 'unknown' // Ensure status is always defined
      }))
    });
  } catch (error) {
    console.error('Error fetching popular cars:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;