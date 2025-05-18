const express = require('express');
const axios = require('axios');
const router = express.Router();
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');

// Set up Khalti configuration
const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000'; 

// API URLs for Khalti - try using the base API endpoint without additional path segments
const KHALTI_API_BASE = 'https://dev.khalti.com/api/v2';

/**
 * Verify Khalti payment
 * @route POST /payment/khalti/verify
 */
router.post('/khalti/verify', auth, async (req, res) => {
  const { token, amount, bookingId } = req.body;
  
  if (!token || !amount || !bookingId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters: token, amount, or bookingId' 
    });
  }
  
  try {
    console.log('Verifying Khalti payment:', { token, amount, bookingId });
    
    // Find booking to ensure it exists and belongs to the user
    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user._id
    });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or does not belong to you'
      });
    }
    
    // Call Khalti API to verify the payment
    const verificationResponse = await axios.post(
      `${KHALTI_API_BASE}/payment/verify/`,
      {
        token: token,
        amount: amount
      },
      {
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti verification response:', verificationResponse.data);
    
    if (verificationResponse.data.idx) {
      // Payment verified successfully, update booking status
      await Booking.findByIdAndUpdate(
        bookingId,
        {
          status: 'confirmed',
          paymentMethod: 'khalti',
          paymentStatus: 'completed',
          paymentId: verificationResponse.data.idx,
          paymentDetails: verificationResponse.data
        }
      );
      
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: verificationResponse.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: verificationResponse.data
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || 'Payment verification failed',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Initiate a payment with Khalti
 * @route POST /payment/khalti/initiate
 */
router.post('/khalti/initiate', auth, async (req, res) => {
  try {
    const { bookingId, amount, returnUrl } = req.body;
    
    // Log the authentication context
    console.log('Payment initiation requested by user:', req.user._id);
    
    if (!bookingId || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: bookingId and amount are required' 
      });
    }
    
    // Find booking
    const booking = await Booking.findById(bookingId).populate('car');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    console.log(`Found booking ${bookingId} for payment initiation`);
    
    // Make sure KHALTI_SECRET_KEY is defined
    if (!KHALTI_SECRET_KEY) {
      console.error('KHALTI_SECRET_KEY is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Payment configuration error: Missing Khalti secret key'
      });
    }
    
    // Format key with prefix if missing
    let formattedKey = KHALTI_SECRET_KEY;
    
    
    
    // Use provided return URL or fallback to the frontend URL
    const finalReturnUrl = returnUrl || `https://car-rental-frontend-green.vercel.app`;
    
    // Create a descriptive name for the booking
    const purchaseOrderName = `Car Rental: ${booking.car?.name || 'Vehicle'} (${booking._id})`;
    
    // Customer info from booking data
    const customerInfo = {
      name: req.user?.name || 'Customer',
      email: req.user?.email || booking.email || 'customer@example.com',
      phone: req.user?.phone || booking.contact || ''
    };
    
    // Convert amount to paisa
    const amountInPaisa = Math.round(amount * 100);

    // Log the amount in both rupees and paisa for clarity
    console.log(`Initiating Khalti payment with amount: ${amount} rupees (${amountInPaisa} paisa)`);
    
    // Create simplified payload for Khalti API
    const payload = {
      return_url: finalReturnUrl,
      website_url: 'http://localhost:5173',
      amount: amountInPaisa,
      purchase_order_id: bookingId.toString(),
      purchase_order_name: purchaseOrderName,
      customer_info: customerInfo,
      product_details: [
        {
          identity: bookingId.toString(),
          name: purchaseOrderName,
          total_price: amountInPaisa,
          quantity: 1,
          unit_price: amountInPaisa
        }
      ]
    };
    
    console.log('Initiating Khalti payment with payload:', {
      ...payload,
      customer_info: { ...payload.customer_info, email: '***@***' }
    });
    
    // Log the key being used (masked)
    console.log('Using formatted Khalti Secret Key:', formattedKey ? 
      `${formattedKey.substring(0, 15)}...${formattedKey.substring(formattedKey.length-4)}` : 
      'UNDEFINED KEY');
    
    try {
      // Try with the formatted key
      console.log('Sending request to Khalti API...');
      const response = await axios({
        method: 'post',
        url: `${KHALTI_API_BASE}/epayment/initiate/`,
        data: payload,
        headers: {
          'Authorization': `Key ${formattedKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('Khalti initiate response:', response.data);
      
      // Update booking with payment details
      await Booking.findByIdAndUpdate(
        bookingId,
        {
          paymentMethod: 'khalti',
          paymentStatus: 'initiated',
          khaltiPidx: response.data.pidx
        }
      );
      
      // Return success response
      return res.status(200).json({
        success: true,
        data: response.data,
        message: 'Payment initiated successfully'
      });
    } catch (apiError) {
      console.error('First Khalti API attempt failed:', apiError.response?.data || apiError.message);
      
      // If the first attempt failed with the formatted key, try with the original key
      if (formattedKey !== KHALTI_SECRET_KEY) {
        console.log('Trying again with original key...');
        try {
          const response = await axios({
            method: 'post',
            url: `${KHALTI_API_BASE}/epayment/initiate/`,
            data: payload,
            headers: {
              'Authorization': `Key ${KHALTI_SECRET_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });
          
          console.log('Second attempt successful:', response.data);
          
          // Update booking with payment details
          await Booking.findByIdAndUpdate(
            bookingId,
            {
              paymentMethod: 'khalti',
              paymentStatus: 'initiated',
              khaltiPidx: response.data.pidx
            }
          );
          
          // Return success response
          return res.status(200).json({
            success: true,
            data: response.data,
            message: 'Payment initiated successfully'
          });
        } catch (secondError) {
          console.error('Second attempt also failed:', secondError.response?.data || secondError.message);
          throw secondError;
        }
      } else {
        throw apiError;
      }
    }
  } catch (error) {
    console.error('Payment initiation error:', error.response?.data || error.message);
    
    // Provide helpful error message
    let errorMessage = 'Failed to initiate payment with the payment gateway';
    
    if (error.response?.data?.detail) {
      errorMessage = `Khalti API error: ${error.response.data.detail}`;
      
      // Special handling for common errors
      if (error.response.data.detail.includes('Invalid token')) {
        errorMessage = 'Payment gateway authentication failed. Please contact support.';
      }
    }
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      error: error.response?.data || { message: error.message }
    });
  }
});

/**
 * Verify payment using Khalti lookup API
 * @route POST /payment/khalti/lookup
 */
router.post('/khalti/lookup', auth, async (req, res) => {
  try {
    const { pidx } = req.body;
    
    if (!pidx) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: pidx'
      });
    }
    
    // Check Khalti payment status
    const response = await axios.post(
      `${KHALTI_API_BASE}/epayment/lookup/`,
      { pidx },
      {
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Khalti lookup response:', response.data);
    
    // Find booking by Khalti pidx
    const booking = await Booking.findOne({ khaltiPidx: pidx });
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    // If payment is completed
    if (response.data.status === 'Completed') {
      await Booking.findByIdAndUpdate(
        booking._id,
        {
          paymentStatus: 'completed',
          transactionId: response.data.transaction_id,
          paymentDetails: response.data,
          status: 'confirmed' // Confirm booking once payment is confirmed
        },
        { new: true }
      );
      
      // Return updated booking
      const updatedBooking = await Booking.findById(booking._id)
        .populate('car')
        .populate('user');
      
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: response.data,
        booking: updatedBooking
      });
    } else if (response.data.status === 'Pending') {
      return res.status(202).json({
        success: false,
        message: 'Payment is pending',
        data: response.data
      });
    } else {
      // Failed, canceled, etc.
      await Booking.findByIdAndUpdate(
        booking._id,
        {
          paymentStatus: 'failed',
          paymentDetails: response.data
        }
      );
      
      return res.status(400).json({
        success: false,
        message: `Payment ${response.data.status}`,
        data: response.data
      });
    }
  } catch (error) {
    console.error('Payment lookup error:', error.response?.data || error.message);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.detail || 'Payment verification failed',
      error: error.response?.data || error.message
    });
  }
});

/**
 * Handle webhook notifications from Khalti
 * @route POST /payment/khalti-webhook
 */
router.post('/khalti-webhook', async (req, res) => {
  try {
    const eventData = req.body;
    console.log('Received webhook from Khalti:', eventData);
    
    const pidx = eventData.pidx;
    const status = eventData.status;
    const transaction_id = eventData.transaction_id;
    
    if (!pidx) {
      console.error('No pidx in webhook data');
      return res.status(200).send('Missing payment identifier');
    }
    
    // Find booking with the pidx
    const booking = await Booking.findOne({ khaltiPidx: pidx });
    
    if (!booking) {
      console.error('No booking found for pidx:', pidx);
      return res.status(200).send('Booking not found');
    }
    
    if (status === 'Completed') {
      // Mark booking as paid
      await Booking.findByIdAndUpdate(
        booking._id,
        {
          paymentStatus: 'completed',
          transactionId: transaction_id,
          paymentDetails: eventData,
          status: 'confirmed' // Confirm booking
        }
      );
    } else if (status === 'Refunded' || status === 'Partially refunded') {
      // Mark booking as refunded
      await Booking.findByIdAndUpdate(
        booking._id,
        {
          paymentStatus: 'refunded',
          paymentDetails: eventData
        }
      );
    }
    
    // Always respond with 200 to webhook calls
    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Always respond with 200 even if processing fails
    return res.status(200).send('Webhook received');
  }
});

/**
 * GET endpoint for payment returns from Khalti
 * This route handles when users are redirected back from Khalti
 * @route GET /payment/payment-return
 */
router.get('/payment-return', async (req, res) => {
  // Log incoming request for debugging
  console.log('Payment return request received:', req.query);
  
  const { pidx, status, purchase_order_id } = req.query;
  
  if (pidx) {
    // For browser-based apps, redirect to the frontend with all query parameters preserved
    const queryString = new URLSearchParams(req.query).toString();
    return res.redirect(`${BASE_URL}/user/payment-confirmation?${queryString}`);
  }
  
  // If this is not a return from Khalti, just redirect to the frontend
  return res.redirect(`${BASE_URL}/user/mybooking`);
});

module.exports = router;
