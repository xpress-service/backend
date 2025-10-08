const axios = require('axios');

async function testAdminLogin() {
  try {
    const loginData = {
      email: 'servixpress247@gmail.com',
      password: 'Admin123!'
    };

    console.log('Testing admin login on production...');
    console.log('URL: https://service-api-t4wo.onrender.com/api/adminAuth/admin-login');
    console.log('Data:', loginData);

    const response = await axios.post(
      'https://service-api-t4wo.onrender.com/api/adminAuth/admin-login',
      loginData,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response:', response.data);

  } catch (error) {
    console.log('❌ ERROR:');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.message);
    console.log('Full error:', error.response?.data);
    console.log('Network error:', error.message);
  }
}

// Run the test
testAdminLogin();