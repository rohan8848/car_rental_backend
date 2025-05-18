const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    default: 'rohanrimal7@gmail.com' // Default email as requested
  },
  tokens: [{
    token: {
      type: String,
      required: true
    }
  }],
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Method to find admin by credentials
adminSchema.statics.findByCredentials = async (username, password) => {
  const admin = await Admin.findOne({ username });
  if (!admin) {
    throw new Error('Invalid login credentials');
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new Error('Invalid login credentials');
  }

  return admin;
};

// Method to generate authentication token
adminSchema.methods.generateAuthToken = async function () {
  const admin = this;
  // Create a token that lasts for 7 days
  const token = jwt.sign({ _id: admin._id.toString() }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
  // Save token to the admin model
  admin.tokens = admin.tokens.concat({ token });
  admin.lastLogin = new Date();
  await admin.save();
  
  return token;
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;