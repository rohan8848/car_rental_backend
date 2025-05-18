const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

const auth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware: No Bearer token');
      return res.status(401).json({ 
        success: false, 
        message: 'Authorization token required' 
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token without assuming which model it belongs to
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Auth middleware: Token decoded successfully', decoded);
    } catch (error) {
      console.log('Auth middleware: Token verification failed', error.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Look for the user/admin based on the path
    const isAdminRoute = req.path.includes('/admin') || req.path.includes('/dashboard');
    
    console.log(`Auth middleware for ${req.path}, isAdminRoute: ${isAdminRoute}, decoded:`, decoded);
    
    // Try to find both admin and user for the token
    // This allows admin tokens to access user routes when needed
    try {
      // First check if this is an admin token
      const adminId = decoded.id || decoded._id;
      const admin = await Admin.findById(adminId);
      
      if (admin) {
        console.log(`Admin found for token: ${admin.username}`);
        req.user = admin;
        req.user.isAdmin = true;
        return next();
      }
    } catch (adminError) {
      console.log("Not an admin token, checking user token");
    }
    
    // If not an admin or admin route, try user
    try {
      const userId = decoded.id || decoded._id;
      const user = await User.findById(userId);
      
      if (!user) {
        console.log(`User not found with ID: ${userId}`);
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication failed: User not found' 
        });
      }
      
      // Check if user is blocked
      if (user.isBlocked) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been blocked' 
        });
      }
      
      req.user = user;
      return next();
    } catch (userError) {
      console.log("User token error:", userError.message);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid user token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed: ' + error.message
    });
  }
};

module.exports = auth;