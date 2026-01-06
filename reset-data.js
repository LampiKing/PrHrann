const https = require('https');

// Production Convex URL
const CONVEX_URL = 'vibrant-dolphin-871.convex.cloud';

const data = JSON.stringify({
  path: "admin:resetAllUserData",
  args: { confirmReset: "RESET_ALL_DATA_CONFIRM" },
  format: "json"
});

console.log('Connecting to:', CONVEX_URL);
console.log('Sending:', data);

const options = {
  hostname: CONVEX_URL,
  port: 443,
  path: '/api/mutation',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
    try {
      const parsed = JSON.parse(body);
      console.log('Parsed:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      // not json
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(data);
req.end();
