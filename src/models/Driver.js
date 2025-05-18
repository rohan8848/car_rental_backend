const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  experience: {
    type: Number, // Years of experience
    required: true,
    min: 0
  },
  licenseImage: {
    type: String, // Path to license image
    default: ''
  },
  profileImage: {
    type: String, // Path to profile image
    default: ''
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'on-leave', 'inactive'],
    default: 'available'
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      trim: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  currentBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  bookingHistory: [{
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate the average rating when driver reviews are updated
driverSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating = totalRating / this.reviews.length;
  }
  next();
});

const Driver = mongoose.model('Driver', driverSchema);
module.exports = Driver;
