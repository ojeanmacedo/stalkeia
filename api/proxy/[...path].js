const https = require('https');

const SITE_KEY = 'f36ea0b8b6c2a6bbd745bc50e473bfc5b39d0c2a075a38e9';
const REMOTE_HOST = 'stalkeia.website';

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse path and query
  const originalUrl = req.url || '';
  // Se o caminho vem como /api/proxy/..., repassa exatamente para https://stalkeia.website/api/proxy/...
  let targetPath = originalUrl;
  if (!targetPath.startsWith('/api/proxy/')) {
    targetPath = '/api/proxy/' + targetPath.replace(/^\//, '');
  }

  const options = {
    hostname: REMOTE_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Site-Key': SITE_KEY,
      'Origin': 'https://stalkeia.website',
      'Referer': 'https://stalkeia.website/',
      'Accept': req.headers['accept'] || '*/*',
      'Content-Type': req.headers['content-type'] || 'application/json'
    }
  };

  const proxyReq = https.request(options, (remoteRes) => {
    // Repassa headers de resposta
    if (remoteRes.headers['content-type']) {
      res.setHeader('Content-Type', remoteRes.headers['content-type']);
    }
    if (remoteRes.headers['cache-control']) {
      res.setHeader('Cache-Control', remoteRes.headers['cache-control']);
    }
    res.statusCode = remoteRes.statusCode || 200;
    remoteRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', message: err.message });
  });

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const postBody = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    proxyReq.write(postBody);
  }

  proxyReq.end();
};
