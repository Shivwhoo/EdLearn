const axios = require('axios');

async function test() {
  try {
    // 1. Sign up
    const email = 'test' + Date.now() + '@example.com';
    const signupRes = await axios.post('http://localhost:5000/api/auth/signup', {
      email,
      password: 'password123',
      fullName: 'Test User'
    });
    const token = signupRes.data.token;
    console.log('Signup successful, token:', token.substring(0, 20) + '...');

    // 2. Test /api/auth/me
    const meRes = await axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Auth Me successful:', meRes.data.user.email);

    // 3. Test /api/sso/handoff directly
    const ssoRes = await axios.post('http://localhost:5000/api/sso/handoff', {
      app: 'edmentor',
      topic: 'React'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('SSO Handoff successful:', ssoRes.data.url);

    // 4. Test /api/sso/handoff through Next.js proxy
    const proxyRes = await axios.post('http://localhost:3000/api/sso/handoff', {
      app: 'edmentor',
      topic: 'React'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('SSO Proxy successful:', proxyRes.data.url);

  } catch (err) {
    if (err.response) {
      console.error('Error response:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

test();
