const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const ROOT = __dirname;
const HIKER_API_KEY = '4euq3qcg1k1v95kjq7d7gc54b8u1mfrp';
const REMOTE_API_HOST = 'stalkeia.website';
const SITE_KEY = 'f36ea0b8b6c2a6bbd745bc50e473bfc5b39d0c2a075a38e9';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

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

function forwardToRemote(req, res, targetPath, postData = null) {
  const options = {
    hostname: REMOTE_API_HOST,
    port: 443,
    path: targetPath,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Site-Key': SITE_KEY,
      'Origin': `https://${REMOTE_API_HOST}`,
      'Referer': `https://${REMOTE_API_HOST}/`,
      'Content-Type': req.headers['content-type'] || 'application/json'
    },
    timeout: 30000
  };

  if (postData) {
    options.headers['Content-Length'] = Buffer.byteLength(postData);
  }

  const upstreamReq = https.request(options, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 200, {
      'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    console.error('Upstream request failed:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erro ao comunicar com o servidor remoto' }));
    }
  });

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tempo limite esgotado' }));
    }
  });

  if (postData) {
    upstreamReq.write(postData);
  }
  upstreamReq.end();
}

function fetchInstagramPublic(username) {
  return new Promise((resolve) => {
    const targetUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const req = https.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-IG-App-ID': '936619743392459',
        'Referer': `https://www.instagram.com/${username}/`
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const u = parsed.data && parsed.data.user;
          if (u) return resolve(u);
        } catch (_) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function buildProfileResponse(username, rawUser) {
  const clean = (username || 'usuario').replace(/^@+/, '').trim();
  if (rawUser) {
    const posts = (rawUser.edge_owner_to_timeline_media?.edges || []).map((e, idx) => {
      const node = e.node || {};
      return {
        id: node.id || `post_${idx}`,
        caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
        taken_at: node.taken_at_timestamp || Math.floor(Date.now() / 1000) - (idx * 86400),
        like_count: node.edge_liked_by?.count || node.edge_media_preview_like?.count || 120,
        comment_count: node.edge_media_to_comment?.count || 15,
        display_url: `/api/proxy/image-proxy.php?url=${encodeURIComponent(node.display_url || node.thumbnail_src || '')}`,
        thumbnail_url: `/api/proxy/image-proxy.php?url=${encodeURIComponent(node.thumbnail_src || node.display_url || '')}`,
        image_versions2: {
          candidates: [{ url: `/api/proxy/image-proxy.php?url=${encodeURIComponent(node.display_url || node.thumbnail_src || '')}`, width: 640, height: 640 }]
        }
      };
    });

    return {
      pk: rawUser.id || '12345678',
      username: rawUser.username || clean,
      full_name: rawUser.full_name || clean,
      biography: rawUser.biography || '',
      profile_pic_url: `/api/proxy/image-proxy.php?url=${encodeURIComponent(rawUser.profile_pic_url_hd || rawUser.profile_pic_url || '')}`,
      is_private: !!rawUser.is_private,
      is_verified: !!rawUser.is_verified,
      is_business: !!rawUser.is_business_account,
      media_count: rawUser.edge_owner_to_timeline_media?.count || posts.length || 12,
      follower_count: rawUser.edge_followed_by?.count || 1250,
      following_count: rawUser.edge_follow?.count || 340,
      lista_perfis_publicos: [
        { username: 'curiosa_oficial', full_name: 'Ana Souza', profile_pic_url: 'https://i.pravatar.cc/150?img=47', is_private: false },
        { username: 'contato_direto', full_name: 'Marcos Lima', profile_pic_url: 'https://i.pravatar.cc/150?img=12', is_private: false },
        { username: 'perfil_suspeito', full_name: 'Juliana Paes', profile_pic_url: 'https://i.pravatar.cc/150?img=28', is_private: false }
      ],
      followers: [],
      chaining_results: [],
      posts: posts,
      followers_posts: posts,
      feed_posts: posts,
      error_count: 0
    };
  }

  // Fallback instantâneo gerado
  return {
    pk: '123456789',
    username: clean,
    full_name: clean.charAt(0).toUpperCase() + clean.slice(1),
    biography: 'Conta ativa no Instagram',
    profile_pic_url: `https://unavatar.io/instagram/${clean}`,
    is_private: false,
    is_verified: true,
    is_business: false,
    media_count: 36,
    follower_count: 1420,
    following_count: 310,
    lista_perfis_publicos: [
      { username: 'amiga_oculta', full_name: 'Camila Santos', profile_pic_url: 'https://i.pravatar.cc/150?img=32', is_private: false },
      { username: 'contato_recente', full_name: 'Lucas Silva', profile_pic_url: 'https://i.pravatar.cc/150?img=11', is_private: false },
      { username: 'curtidas_secretas', full_name: 'Mariana Costa', profile_pic_url: 'https://i.pravatar.cc/150?img=45', is_private: false }
    ],
    followers: [],
    chaining_results: [],
    posts: [
      {
        id: 'post_1',
        caption: 'Momento de lazer...',
        taken_at: Math.floor(Date.now() / 1000) - 7200,
        like_count: 342,
        comment_count: 24,
        display_url: '/images/screenshots/fotoblur1.jpg',
        thumbnail_url: '/images/screenshots/fotoblur1.jpg',
        image_versions2: { candidates: [{ url: '/images/screenshots/fotoblur1.jpg', width: 640, height: 640 }] }
      },
      {
        id: 'post_2',
        caption: 'Encontro de hoje 😉',
        taken_at: Math.floor(Date.now() / 1000) - 86400,
        like_count: 489,
        comment_count: 41,
        display_url: '/images/screenshots/fotoblur2.jpg',
        thumbnail_url: '/images/screenshots/fotoblur2.jpg',
        image_versions2: { candidates: [{ url: '/images/screenshots/fotoblur2.jpg', width: 640, height: 640 }] }
      }
    ],
    feed_posts: [],
    followers_posts: [],
    error_count: 0
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // 1. Leads Status / Save
  if (pathname === '/api/proxy/leads.php') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      forwardToRemote(req, res, req.url, body || null);
    });
    return;
  }

  // 2. HikerAPI compatibility (Instagram profile, following, posts)
  if (pathname === '/api/proxy/hikerapi.php') {
    try {
      const result = await fetchHikerDirect(pathname, parsedUrl.query);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(result.data));
    } catch (err) {
      console.warn('HikerAPI direct failed, using stalkeia.website backup:', err.message);
      forwardToRemote(req, res, req.url);
      return;
    }
  }

  // 3. Instagram Proxy
  if (pathname === '/api/proxy/instagram.php') {
    forwardToRemote(req, res, req.url);
    return;
  }

  // 4. Image Proxy
  if (pathname === '/api/proxy/image-proxy.php') {
    const target = parsedUrl.query.url;
    if (!target) {
      res.writeHead(400);
      return res.end();
    }
    
    // Se for URL de CDN instagram ou outra, busca com os headers corretos
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/'
      },
      timeout: 10000
    };

    const client = target.startsWith('https') ? https : http;
    client.get(target, options, (upstreamRes) => {
      if (upstreamRes.statusCode >= 400) {
        // Fallback: tenta via stalkeia.website proxy
        forwardToRemote(req, res, req.url);
        return;
      }
      res.writeHead(upstreamRes.statusCode || 200, {
        'Content-Type': upstreamRes.headers['content-type'] || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      upstreamRes.pipe(res);
    }).on('error', () => {
      forwardToRemote(req, res, req.url);
    });
    return;
  }

  // 5. Static Files & SPA Fallback
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(ROOT, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[STALKEA] Servidor 100% ativo em http://localhost:${PORT}`);
});
