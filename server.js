const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const HIKER_API_KEY = '4euq3qcg1k1v95kjq7d7gc54b8u1mfrp';
const OUR_SITE_KEY = 'ad89275a6835799e13a8e780c480b8646e80512e4a63183c';
const REMOTE_API_HOST = 'stalkeia.website';
const SITE_KEY = 'f36ea0b8b6c2a6bbd745bc50e473bfc5b39d0c2a075a38e9';

process.on('uncaughtException', (err) => {
  console.error('[SERVER UNCAUGHT ERROR]', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[SERVER UNHANDLED REJECTION]', reason);
});

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
    if (!res.headersSent) {
      res.writeHead(upstreamRes.statusCode || 200, {
        'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
    }
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

const REAL_MEN = [
  { username: "lucas.silva", full_name: "Lucas Silva", profile_pic_url: "/fotos pessoas reais/homem1.jpg" },
  { username: "gabriel.alves", full_name: "Gabriel Alves", profile_pic_url: "/fotos pessoas reais/homem2.jpg" },
  { username: "rodrigo.moraes", full_name: "Rodrigo Moraes", profile_pic_url: "/fotos pessoas reais/homem3.jpg" },
  { username: "matheus.costa", full_name: "Matheus Costa", profile_pic_url: "/fotos pessoas reais/homem4.jpg" },
  { username: "rafael.carvalho", full_name: "Rafael Carvalho", profile_pic_url: "/fotos pessoas reais/homem5.jpg" },
  { username: "thiago.rocha", full_name: "Thiago Rocha", profile_pic_url: "/fotos pessoas reais/homem6.jpg" },
  { username: "bruno.ribeiro", full_name: "Bruno Ribeiro", profile_pic_url: "/fotos pessoas reais/homem7.jpg" },
  { username: "felipe.fernandes", full_name: "Felipe Fernandes", profile_pic_url: "/fotos pessoas reais/homem8.jpg" },
  { username: "gustavo.lima", full_name: "Gustavo Lima", profile_pic_url: "/fotos pessoas reais/homem9.jpg" },
  { username: "daniel.barbosa", full_name: "Daniel Barbosa", profile_pic_url: "/fotos pessoas reais/homem10.jpg" }
];

const REAL_WOMEN = [
  { username: "camila.santos", full_name: "Camila Santos", profile_pic_url: "/fotos pessoas reais/mulher1.jpg" },
  { username: "julia.oliveira", full_name: "Julia Oliveira", profile_pic_url: "/fotos pessoas reais/mulher2.jpg" },
  { username: "mariana.costa", full_name: "Mariana Costa", profile_pic_url: "/fotos pessoas reais/mulher3.jpg" },
  { username: "larissa.almeida", full_name: "Larissa Almeida", profile_pic_url: "/fotos pessoas reais/mulher4.jpg" },
  { username: "beatriz.rodrigues", full_name: "Beatriz Rodrigues", profile_pic_url: "/fotos pessoas reais/mulher5.jpg" },
  { username: "amanda.pereira", full_name: "Amanda Pereira", profile_pic_url: "/fotos pessoas reais/mulher6.jpg" },
  { username: "fernanda.nascimento", full_name: "Fernanda Nascimento", profile_pic_url: "/fotos pessoas reais/mulher7.jpg" },
  { username: "isabela.lima", full_name: "Isabela Lima", profile_pic_url: "/fotos pessoas reais/mulher8.jpg" },
  { username: "carolina.souza", full_name: "Carolina Souza", profile_pic_url: "/fotos pessoas reais/mulher9.jpg" },
  { username: "luana.martins", full_name: "Luana Martins", profile_pic_url: "/fotos pessoas reais/mulher10.jpg" }
];

function detectTargetGender(targetUser = '', targetName = '') {
  const combined = `${targetName} ${targetUser}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const businessKeywords = [
    "loja", "produtos", "estetica", "automotiva", "oficina", "advocac", "refrigerac",
    "climatizac", "marketing", "agencia", "imoveis", "store", "shop", "assessoria", "studio"
  ];
  for (const b of businessKeywords) {
    if (combined.includes(b)) return "business";
  }

  const maleMatches = [
    "lucas", "gabriel", "rodrigo", "matheus", "rafael", "thiago", "tiago",
    "bruno", "felipe", "gustavo", "daniel", "pedro", "joao", "guilherme",
    "arthur", "bernardo", "caio", "diego", "eduardo", "enzo", "heitor",
    "henrique", "igor", "jean", "leonardo", "leo", "marcelo", "marcos",
    "nicolas", "otavio", "paulo", "renan", "samuel", "victor", "vitor",
    "vinicius", "yuri", "carlos", "carlinhos", "andre", "ricardo", "fernando", "alexandre",
    "valdir", "pablo", "wesley", "danil", "vidal", "alysson", "alisson",
    "marinho", "mario", "mariano", "rhonner", "rhoner", "keven", "reinaldo", "cariani"
  ];

  for (const m of maleMatches) {
    if (new RegExp(`(?:^|[^a-z])${m}(?:$|[^a-z])`, "i").test(combined) || combined.includes(m)) {
      return "male";
    }
  }

  const femaleMatches = [
    "julia", "juliana", "juu", "juuh", "maria", "mariana", "camila",
    "ana", "beatriz", "bia", "amanda", "fernanda", "nanda", "larissa", "lari",
    "isabela", "isabella", "isa", "bela", "carolina", "carol", "luana", "leticia", "leh",
    "gabriela", "gabi", "bruna", "bru", "jessica", "vanessa", "paula", "aline",
    "patricia", "renata", "thais", "duda", "eduarda", "claudia", "debora", "raquel",
    "sabrina", "natalia", "vitoria", "monica", "giovanna", "manu", "manuela",
    "helena", "sophia", "alice", "laura", "valentina", "yasmin", "melissa", "barbara", "babs",
    "isadora", "michelly", "michele", "paolla", "paola", "mafeh", "mafe",
    "marina", "marilia", "carla", "tatiana", "tati", "valeria", "priscila", "evelyn",
    "emylly", "emily", "jordana", "erica", "cidinha", "dani", "daniela", "daniele"
  ];

  for (const f of femaleMatches) {
    if (new RegExp(`(?:^|[^a-z])${f}(?:$|[^a-z])`, "i").test(combined) || (f.length > 3 && combined.includes(f))) {
      return "female";
    }
  }

  const firstName = (targetName.trim().split(/\s+/)[0] || targetUser.split(/[._]/)[0] || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (firstName.endsWith("a") && !["lucas", "alexandre", "joshua", "ayrton", "marcal", "maia"].includes(firstName)) {
    return "female";
  }

  return "male";
}

function generateMockFriends(count = 25, targetUsername = '', targetFullName = '') {
  const gender = detectTargetGender(targetUsername, targetFullName);
  const primaryList = gender === "female" ? REAL_MEN : REAL_WOMEN;
  const secondaryList = gender === "female" ? REAL_WOMEN : REAL_MEN;

  const result = [];
  let pIdx = 0;
  let sIdx = 0;

  // Os 3 primeiros (Melhores Amigos) são 100% do gênero oposto
  for (let i = 0; i < 3; i++) {
    const item = primaryList[pIdx % primaryList.length];
    pIdx++;
    result.push({
      ...item,
      pk: String(100000000 + result.length),
      id: String(100000000 + result.length),
      profile_pic_url_hd: item.profile_pic_url,
      is_private: false,
      is_verified: false,
      media_count: Math.floor(Math.random() * 120 + 10),
      follower_count: Math.floor(Math.random() * 2000 + 350),
      following_count: Math.floor(Math.random() * 800 + 150)
    });
  }

  while (result.length < count) {
    for (let k = 0; k < 3 && result.length < count; k++) {
      const item = primaryList[pIdx % primaryList.length];
      pIdx++;
      result.push({
        ...item,
        pk: String(100000000 + result.length),
        id: String(100000000 + result.length),
        profile_pic_url_hd: item.profile_pic_url,
        is_private: false,
        is_verified: false,
        media_count: Math.floor(Math.random() * 120 + 10),
        follower_count: Math.floor(Math.random() * 2000 + 350),
        following_count: Math.floor(Math.random() * 800 + 150)
      });
    }
    if (result.length < count) {
      const item = secondaryList[sIdx % secondaryList.length];
      sIdx++;
      result.push({
        ...item,
        pk: String(100000000 + result.length),
        id: String(100000000 + result.length),
        profile_pic_url_hd: item.profile_pic_url,
        is_private: false,
        is_verified: false,
        media_count: Math.floor(Math.random() * 120 + 10),
        follower_count: Math.floor(Math.random() * 2000 + 350),
        following_count: Math.floor(Math.random() * 800 + 150)
      });
    }
  }

  return result;
}

function organizeFriendsByGender(friendsList = [], targetUser = '', targetName = '') {
  if (!Array.isArray(friendsList) || friendsList.length === 0) {
    return generateMockFriends(25, targetUser, targetName);
  }

  const targetGender = detectTargetGender(targetUser, targetName);
  const desiredGender = targetGender === "female" ? "male" : "female";

  const isMockList = friendsList.some(f => f?.profile_pic_url?.includes('/fotos pessoas reais/'));
  if (isMockList) {
    return generateMockFriends(25, targetUser, targetName);
  }

  // Lista de amigos reais vindos da API
  const oppositeGenderFriends = [];
  const sameGenderFriends = [];

  for (const f of friendsList) {
    if (!f || !f.username) continue;
    const g = detectTargetGender(f.username, f.full_name || "");
    if (g === "business") {
      sameGenderFriends.push(f);
    } else if (g === desiredGender) {
      oppositeGenderFriends.push(f);
    } else {
      sameGenderFriends.push(f);
    }
  }

  const result = [];
  let oppIdx = 0;
  let sameIdx = 0;

  // 1. Top 3: prioriza amigos reais do gênero oposto
  for (let i = 0; i < 3; i++) {
    if (oppIdx < oppositeGenderFriends.length) {
      result.push(oppositeGenderFriends[oppIdx++]);
    } else if (sameIdx < sameGenderFriends.length) {
      result.push(sameGenderFriends[sameIdx++]);
    }
  }

  // 2. Restante: prioriza amigos reais do gênero oposto (~80% ou até esgotar) e adiciona os demais amigos reais
  while (oppIdx < oppositeGenderFriends.length || sameIdx < sameGenderFriends.length) {
    for (let k = 0; k < 3 && oppIdx < oppositeGenderFriends.length; k++) {
      result.push(oppositeGenderFriends[oppIdx++]);
    }
    if (sameIdx < sameGenderFriends.length) {
      result.push(sameGenderFriends[sameIdx++]);
    }
  }

  // Preenche até 25 ciclando apenas os amigos reais existentes, se necessário
  if (result.length > 0 && result.length < 25) {
    const origLen = result.length;
    let cIdx = 0;
    while (result.length < 25) {
      result.push(result[cIdx % origLen]);
      cIdx++;
    }
  }

  return result;
}

const userCache = {};
let lastSearchedUser = { username: '', full_name: '' };

function fetchRemoteHiker(hikerPath, query = {}) {
  return new Promise((resolve, reject) => {
    let cleanPath = hikerPath;
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    const cleanQuery = { ...query };
    delete cleanQuery.path;
    const qStr = new URLSearchParams(cleanQuery).toString();
    const fullPath = `/api/proxy/hikerapi.php?path=${encodeURIComponent(cleanPath)}${qStr ? '&' + qStr : ''}`;
    const options = {
      hostname: REMOTE_API_HOST,
      port: 443,
      path: fullPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Site-Key': SITE_KEY,
        'Origin': `https://${REMOTE_API_HOST}`,
        'Referer': `https://${REMOTE_API_HOST}/`
      },
      timeout: 15000
    };
    const req = https.get(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ statusCode: res.statusCode, data: null });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const wrapImageProxy = (picUrl) => {
  if (!picUrl || typeof picUrl !== 'string') return picUrl || '';
  if (picUrl.startsWith('/api/proxy/image-proxy.php') || picUrl.startsWith('/fotos pessoas reais/') || picUrl.startsWith('/images/')) {
    return picUrl;
  }
  if (picUrl.startsWith('http://') || picUrl.startsWith('https://')) {
    return `/api/proxy/image-proxy.php?url=${encodeURIComponent(picUrl)}`;
  }
  return picUrl;
};

function buildProfileResponse(username, rawUser) {
  const clean = (username || 'usuario').replace(/^@+/, '').trim();
  const mockFriends = generateMockFriends(25, clean, rawUser?.full_name || '');
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
      lista_perfis_publicos: mockFriends,
      followers: mockFriends,
      chaining_results: mockFriends,
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
    profile_pic_url: detectTargetGender(clean) === 'female' ? '/fotos pessoas reais/mulher2.jpg' : '/fotos pessoas reais/homem1.jpg',
    is_private: false,
    is_verified: true,
    is_business: false,
    media_count: 36,
    follower_count: 1420,
    following_count: 310,
    lista_perfis_publicos: mockFriends,
    followers: mockFriends,
    chaining_results: mockFriends,
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

  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';
  const siteKey = req.headers['x-site-key'] || '';

  const isAllowedOrigin = 
    origin.includes('stalkea.top') || 
    referer.includes('stalkea.top') || 
    host.includes('stalkea.top') ||
    origin.includes('localhost') || 
    referer.includes('localhost') || 
    host.includes('localhost');

  const isValidSecret = siteKey === OUR_SITE_KEY || siteKey === SITE_KEY;

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (isValidSecret) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (pathname.startsWith('/api/') && !pathname.includes('image-proxy.php')) {
    if (!isAllowedOrigin && !isValidSecret) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Acesso negado: Origem não autorizada.' }));
    }
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
    const hikerPath = parsedUrl.query.path || '';
    try {
      const result = await fetchRemoteHiker(hikerPath, parsedUrl.query);
      if (result && result.statusCode === 200 && result.data) {
        if (result.data.user) {
          const u = result.data.user;
          const uInfo = {
            username: u.username,
            full_name: u.full_name || u.username
          };
          userCache[String(u.pk || u.id)] = uInfo;
          lastSearchedUser = uInfo;
        }

        if (hikerPath.includes('/user/following') && result.data.response?.users) {
          const targetUserId = String(parsedUrl.query.user_id || '');
          const cached = userCache[targetUserId] || lastSearchedUser;
          let users = result.data.response.users.map(item => ({
            ...item,
            profile_pic_url: wrapImageProxy(item.profile_pic_url)
          }));
          result.data.response.users = organizeFriendsByGender(users, cached.username, cached.full_name);
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify(result.data));
      }
    } catch (err) {
      console.warn('Remote hiker failed in hikerapi.php:', err.message);
    }
    forwardToRemote(req, res, req.url);
    return;
  }

  // 3. Instagram Proxy
  if (pathname === '/api/proxy/instagram.php') {
    const tipo = parsedUrl.query.tipo;
    const userParam = (parsedUrl.query.username || '').replace(/^@+/, '').trim();
    if (tipo === 'all' || tipo === 'busca_completa') {
      try {
        const uRes = await fetchRemoteHiker('/v2/user/by/username', { username: userParam });
        if (uRes.statusCode === 200 && uRes.data?.user) {
          const u = uRes.data.user;
          let realFriends = [];
          if (!u.is_private && u.pk) {
            const fRes = await fetchRemoteHiker('/v2/user/following', { user_id: u.pk, page_id: '1' });
            if (fRes.statusCode === 200 && fRes.data?.response?.users) {
              realFriends = fRes.data.response.users.map(item => ({
                ...item,
                profile_pic_url: wrapImageProxy(item.profile_pic_url)
              }));
              realFriends = organizeFriendsByGender(realFriends, u.username, u.full_name);
            }
          }
          if (realFriends.length === 0) {
            realFriends = generateMockFriends(25, userParam, u.full_name);
          }
          const resData = {
            success: true,
            profile: {
              pk: u.pk,
              username: u.username,
              full_name: u.full_name || u.username,
              biography: u.biography || '',
              profile_pic_url: wrapImageProxy(u.profile_pic_url_hd || u.profile_pic_url),
              is_private: !!u.is_private,
              is_verified: !!u.is_verified,
              is_business: !!u.is_business_account,
              media_count: u.media_count || 0,
              follower_count: u.follower_count || 0,
              following_count: u.following_count || 0
            },
            lista_perfis_publicos: realFriends,
            followers: realFriends,
            chaining_results: realFriends,
            posts: [],
            followers_posts: [],
            feed_posts: [],
            error_count: 0
          };
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify(resData));
        }
      } catch (e) {
        console.warn('Remote hiker complete fetch failed in instagram.php:', e.message);
      }
      const mockFriends = generateMockFriends(25, userParam || '');
      const resData = {
        success: true,
        profile: buildProfileResponse(userParam),
        lista_perfis_publicos: mockFriends,
        followers: mockFriends,
        chaining_results: mockFriends,
        posts: [],
        followers_posts: [],
        feed_posts: [],
        error_count: 0
      };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(resData));
    }
    forwardToRemote(req, res, req.url);
    return;
  }

  // 4. Image Proxy
  if (pathname === '/api/proxy/image-proxy.php') {
    let target = parsedUrl.query.url;
    if (!target) {
      res.writeHead(400);
      return res.end();
    }

    // Desembrulha caso venha aninhado
    while (typeof target === 'string' && (target.startsWith('/api/proxy/image-proxy.php') || target.includes('image-proxy.php?url='))) {
      const idx = target.indexOf('url=');
      if (idx !== -1) {
        target = decodeURIComponent(target.substring(idx + 4));
      } else {
        break;
      }
    }

    // Se for caminho local no disco, redireciona para o arquivo
    if (typeof target === 'string' && target.startsWith('/')) {
      res.writeHead(302, { Location: target });
      return res.end();
    }

    try {
      const parsedTarget = new URL(target);
      const client = parsedTarget.protocol === 'https:' ? https : http;
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.instagram.com/'
        },
        timeout: 10000
      };

      const upstreamReq = client.get(target, options, (upstreamRes) => {
        if (upstreamRes.statusCode >= 400) {
          if (!res.headersSent) forwardToRemote(req, res, req.url);
          return;
        }
        if (!res.headersSent) {
          res.writeHead(upstreamRes.statusCode || 200, {
            'Content-Type': upstreamRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
        }
        upstreamRes.pipe(res);
      });

      upstreamReq.on('error', () => {
        if (!res.headersSent) forwardToRemote(req, res, req.url);
      });
      upstreamReq.on('timeout', () => {
        upstreamReq.destroy();
        if (!res.headersSent) forwardToRemote(req, res, req.url);
      });
    } catch (e) {
      if (!res.headersSent) forwardToRemote(req, res, req.url);
    }
    return;
  }

  // 5. Static Files & SPA Fallback
  let decodedPath = decodeURIComponent(pathname);
  let filePath = path.join(ROOT, decodedPath === '/' ? 'index.html' : decodedPath);
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
