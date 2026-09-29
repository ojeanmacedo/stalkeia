const https = require('https');
const http = require('http');
const url = require('url');

const HIKER_API_KEY = '4euq3qcg1k1v95kjq7d7gc54b8u1mfrp';
const BACKUP_SITE_KEY = 'f36ea0b8b6c2a6bbd745bc50e473bfc5b39d0c2a075a38e9';
const BACKUP_REMOTE_HOST = 'stalkeia.website';

// Faz requisição direta na HikerAPI oficial
function fetchHikerDirect(reqPath, queryObj) {
  return new Promise((resolve, reject) => {
    let hikerPath = queryObj.path || reqPath.replace('/api/proxy/hikerapi.php', '');
    if (!hikerPath.startsWith('/')) {
      hikerPath = '/' + hikerPath;
    }

    const q = { ...queryObj };
    delete q.path;
    const queryStr = new URLSearchParams(q).toString();
    const fullPath = `${hikerPath}${queryStr ? '?' + queryStr : ''}`;

    const options = {
      hostname: 'api.hikerapi.com',
      port: 443,
      path: fullPath,
      method: 'GET',
      headers: {
        'x-access-key': HIKER_API_KEY,
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 15000
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && !parsed.error && parsed.state !== false) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            reject(new Error(`HikerAPI returned status ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON from HikerAPI: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HikerAPI direct timeout')); });
  });
}

// Faz fallback para o stalkeia.website
function forwardToBackup(req, res, targetPath) {
  const options = {
    hostname: BACKUP_REMOTE_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Site-Key': BACKUP_SITE_KEY,
      'Origin': `https://${BACKUP_REMOTE_HOST}`,
      'Referer': `https://${BACKUP_REMOTE_HOST}/`,
      'Accept': req.headers['accept'] || '*/*',
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    timeout: 20000
  };

  const proxyReq = https.request(options, (remoteRes) => {
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
    console.error('Backup proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed', message: err.message });
  });

  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const postBody = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    proxyReq.write(postBody);
  }

  proxyReq.end();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '';
  const originalUrl = req.url || '';

  let targetPath = originalUrl;
  if (!targetPath.startsWith('/api/proxy/')) {
    targetPath = '/api/proxy/' + targetPath.replace(/^\//, '');
  }

  // 1. Image Proxy
  if (pathname.includes('image-proxy.php')) {
    const imgUrl = parsedUrl.query.url;
    if (imgUrl) {
      const client = imgUrl.startsWith('https') ? https : http;
      const imgReq = client.get(imgUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.instagram.com/'
        },
        timeout: 10000
      }, (imgRes) => {
        if (imgRes.statusCode < 400) {
          res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.statusCode = imgRes.statusCode || 200;
          return imgRes.pipe(res);
        }
        forwardToBackup(req, res, targetPath);
      });
      imgReq.on('error', () => forwardToBackup(req, res, targetPath));
      return;
    }
  }

  // 2. HikerAPI: Tenta chave primária direta, se falhar faz fallback pro backup
  if (pathname.includes('hikerapi.php') && req.method === 'GET') {
    try {
      const result = await fetchHikerDirect(pathname, parsedUrl.query);
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify(result.data));
    } catch (err) {
      console.warn('HikerAPI direct failed, using stalkeia.website backup:', err.message);
      return forwardToBackup(req, res, targetPath);
    }
  }

  // 3. Demais endpoints
  forwardToBackup(req, res, targetPath);
};
