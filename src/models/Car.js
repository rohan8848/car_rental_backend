const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
  },
  transmission: {
    type: String,
    required: true,
    enum: ['Manual', 'Automatic']
  },
  fuel: {
    type: String,
    required: true,
    enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid']
  },
  seats: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  mileage: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  status: {
    type: String,
    enum: ['available', 'not-available', 'out-of-service', 'available-soon'],
    default: 'available'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  }
}, {
  timestamps: true
});

carSchema.index({ location: '2dsphere' });

const Car = mongoose.model('Car', carSchema);
module.exports = Car;