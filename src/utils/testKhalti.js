/**
 * Utility to test Khalti API connection
 * Run with: node src/utils/testKhalti.js
 */
require('dotenv').config();
const axios = require('axios');

async function testKhaltiConnection() {
  const KHALTI_SECRET_KEY = process.env.KHALTI_SECRET_KEY;
  console.log('Testing Khalti API connection...');
  
  if (!KHALTI_SECRET_KEY) {
    console.error('❌ ERROR: KHALTI_SECRET_KEY not found in environment variables');
    return false;
  }
  
  console.log('Using Khalti key:', `${KHALTI_SECRET_KEY.substring(0, 15)}...${KHALTI_SECRET_KEY.substring(KHALTI_SECRET_KEY.length-4)}`);
  
  // Check if key format is correct
  if (!KHALTI_SECRET_KEY.startsWith('test_secret_key_') && !KHALTI_SECRET_KEY.startsWith('live_secret_key_')) {
    console.warn('⚠️ WARNING: Your key format may be incorrect. Khalti secret keys should start with test_secret_key_ or live_secret_key_');
  }
  
  // Simple test payload
  const testPayload = {
    return_url: 'http://localhost:5173/test-return',
    website_url: 'http://localhost:5173',
    amount: 1000, // 10 rupees in paisa
    purchase_order_id: `test-${Date.now()}`,
    purchase_order_name: 'Test Payment',
    customer_info: {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '9800000000'
    },
    product_details: [{
      identity: 'test-product',
      name: 'Test Product',
      total_price: 1000,
      quantity: 1,
      unit_price: 1000
    }]
  };
  
  try {
    const response = await axios.post(
      'https://khalti.com/api/v2/epayment/initiate/',
      testPayload,
      {
        headers: {
          'Authorization': `Key ${KHALTI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ SUCCESS: Khalti API test connection successful!');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ ERROR: Khalti API test failed');
    console.error('Error details:', error.response?.data || error.message);
    
    if (error.response?.data?.detail === 'Invalid token.') {
      console.log('\n🔑 SOLUTION: Your KHALTI_SECRET_KEY is in an incorrect format.');
      console.log('It should be in the format: test_secret_key_XXXXXXXXXXXXXXXXXXXXXXXX');
      console.log('Please update your .env file with the correct key format.');
    }
    
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testKhaltiConnection().then(success => {
    if (success) {
      console.log('Test completed successfully! Khalti payment integration should work.');
    } else {
      console.log('Test failed. Please fix the issues before proceeding.');
      process.exit(1);
    }
  }).catch(err => {
    console.error('Error running test:', err);
    process.exit(1);
  });
} else {
  module.exports = { testKhaltiConnection };
}
