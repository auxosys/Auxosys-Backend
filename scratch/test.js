const https = require('https');
const http = require('http');

function fetchBase64(url, retries = 2, redirectCount = 0) {
  if (!url) return Promise.resolve('');
  if (url.startsWith('data:')) return Promise.resolve(url);
  if (redirectCount > 5) return Promise.resolve(url);

  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBase64(res.headers.location, retries, redirectCount + 1));
      }
      
      if (res.statusCode !== 200) {
        if (retries > 0) {
          setTimeout(() => resolve(fetchBase64(url, retries - 1, redirectCount)), 500);
          return;
        }
        return resolve(url);
      }
      
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mime = res.headers['content-type'] || 'image/png';
        resolve(`data:${mime};base64,${buffer.toString('base64')}`);
      });
    }).on('error', (err) => {
      console.error('Network Error:', err);
      if (retries > 0) {
        setTimeout(() => resolve(fetchBase64(url, retries - 1, redirectCount)), 500);
        return;
      }
      resolve(url);
    });
  });
}

async function test() {
  const testUrl = 'https://grkeeulwpstjmqmmmjgo.supabase.co/storage/v1/object/public/signatures/sample.png';
  try {
    const result = await fetchBase64(testUrl);
    console.log('Result length:', result.length);
    console.log('Starts with:', result.substring(0, 30));
  } catch (err) {
    console.error('Caught error:', err);
  }
}

test();
