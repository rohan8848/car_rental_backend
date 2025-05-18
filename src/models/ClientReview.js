const mongoose = require('mongoose');

const clientReviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  logo: {
    type: String,
    default: 'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg'
  },
  review: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const ClientReview = mongoose.model('ClientReview', clientReviewSchema);
module.exports = ClientReview;
