const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
// Connect to MongoDB
const connectDB = () => {
    mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('Could not connect to MongoDB:', err));
}

module.exports = connectDB;
