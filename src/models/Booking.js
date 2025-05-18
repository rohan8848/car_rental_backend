const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  contact: {
    type: String,
    required: true
  },
  // For single location bookings
  location: {
    lat: {
      type: Number
    },
    lng: {
      type: Number
    }
  },
  // For separate pickup/dropoff bookings
  hasSeparateLocations: {
    type: Boolean,
    default: false
  },
  pickupCoords: {
    lat: {
      type: Number
    },
    lng: {
      type: Number
    }
  },
  dropoffCoords: {
    lat: {
      type: Number
    },
    lng: {
      type: Number
    }
  },
  pickupAddress: String,
  dropoffAddress: String,
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  needsDriver: {
    type: Boolean,
    default: false
  },
  driverPrice: {
    type: Number,
    default: 0
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null
  },
  driverAssigned: {
    type: Boolean,
    default: false
  },
  transactionId: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'khalti'],
    default: 'cod'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  khaltiPidx: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;