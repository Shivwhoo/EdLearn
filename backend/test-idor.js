const http = require('http');

async function main() {
  // 1. Create two users
  const emailA = 'user_a@example.com';
  const emailB = 'user_b@example.com';
  
  let tokenA = '', tokenB = '';

  for (const email of [emailA, emailB]) {
    try {
      let res = await fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Password123!', fullName: email })
      });
      let data = await res.json();
      if (data.token) {
        if (email === emailA) tokenA = data.token;
        else tokenB = data.token;
      } else {
        res = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'Password123!' })
        });
        data = await res.json();
        if (email === emailA) tokenA = data.token;
        else tokenB = data.token;
      }
    } catch(e) {
      console.error('Auth error', e);
      return;
    }
  }

  // 4. Test IDOR: Try to fetch a fabricated job ID
  console.log("\n--- IDOR TEST: User A fetching fabricated job ID ---");
  const idorRes = await fetch(`http://localhost:5000/api/jobs/999999999`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  
  console.log("Status:", idorRes.status);
  console.log("Response:", await idorRes.json());
}

main().catch(console.error).finally(() => process.exit(0));
