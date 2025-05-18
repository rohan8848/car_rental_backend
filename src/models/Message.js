const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true,
    enum: ['general', 'reservation', 'support', 'feedback', 'partnership']
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'unread',
    enum: ['unread', 'read', 'responded']
  },
  response: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
