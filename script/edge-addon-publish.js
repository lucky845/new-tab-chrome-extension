// edge-addon-publish.js
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

// 需在环境变量或 secrets 中配置
const CLIENT_ID = process.env.EDGE_CLIENT_ID;
const CLIENT_SECRET = process.env.EDGE_CLIENT_SECRET;
const PRODUCT_ID = process.env.EDGE_PRODUCT_ID;
const EXTENSION_FILE = process.env.EDGE_EXTENSION_FILE; // .zip 或 .crx 路径

async function getAccessToken() {
  const url = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://addons.microsoftedge.microsoft.com/.default'
  });
  const res = await axios.post(url, params);
  return res.data.access_token;
}

async function uploadExtension(token) {
  const url = `https://addons.microsoftedge.microsoft.com/api/v1/products/${PRODUCT_ID}/submissions/draft/package`;
  const form = new FormData();
  form.append('file', fs.createReadStream(EXTENSION_FILE));
  const res = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${token}`
    }
  });
  return res.data;
}

async function publishExtension(token) {
  const url = `https://addons.microsoftedge.microsoft.com/api/v1/products/${PRODUCT_ID}/submissions/draft/publish`;
  const res = await axios.post(url, {}, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.data;
}

(async () => {
  try {
    const token = await getAccessToken();
    console.log('Access token obtained.');
    await uploadExtension(token);
    console.log('Extension uploaded.');
    await publishExtension(token);
    console.log('Extension published.');
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
    process.exit(1);
  }
})();