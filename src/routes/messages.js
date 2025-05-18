const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const auth = require('../middleware/auth');

// Submit a new message (public route)
router.post('/', async (req, res) => {
  try {
    const { name, email, topic, message } = req.body;
    
    if (!name || !email || !topic || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }
    
    const newMessage = new Message({
      name,
      email,
      topic,
      message
    });
    
    await newMessage.save();
    
    res.status(201).json({
      success: true,
      message: 'Message sent successfully. We will contact you soon.'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get all messages (admin only)
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const messages = await Message.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Mark message as read/responded
router.put('/:id/status', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const { status, response } = req.body;
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    message.status = status || message.status;
    if (response) message.response = response;
    
    await message.save();
    
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error updating message status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Delete a message
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access' 
      });
    }
    
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }
    
    await Message.deleteOne({ _id: req.params.id });
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;
