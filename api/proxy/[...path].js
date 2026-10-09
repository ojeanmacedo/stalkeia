const https = require('https');
const http = require('http');
const url = require('url');

const REMOTE_API_HOST = 'stalkeia.website';
const SITE_KEY = 'f36ea0b8b6c2a6bbd745bc50e473bfc5b39d0c2a075a38e9';

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

  for (let i = 0; i < 3; i++) {
    if (oppIdx < oppositeGenderFriends.length) {
      result.push(oppositeGenderFriends[oppIdx++]);
    } else if (sameIdx < sameGenderFriends.length) {
      result.push(sameGenderFriends[sameIdx++]);
    }
  }

  while (oppIdx < oppositeGenderFriends.length || sameIdx < sameGenderFriends.length) {
    for (let k = 0; k < 3 && oppIdx < oppositeGenderFriends.length; k++) {
      result.push(oppositeGenderFriends[oppIdx++]);
    }
    if (sameIdx < sameGenderFriends.length) {
      result.push(sameGenderFriends[sameIdx++]);
    }
  }

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

module.exports = async (req, res) => {
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  const host = req.headers['host'] || '';
  const siteKey = req.headers['x-site-key'] || '';

  // Permite estritamente apenas o domínio stalkea.top (e subdomínios como oficial.stalkea.top) ou localhost para testes
  const isAllowedOrigin = 
    origin.includes('stalkea.top') || 
    referer.includes('stalkea.top') || 
    host.includes('stalkea.top') ||
    origin.includes('localhost') || 
    referer.includes('localhost') || 
    host.includes('localhost');

  const isValidSecret = siteKey === 'ad89275a6835799e13a8e780c480b8646e80512e4a63183c' || siteKey === SITE_KEY;

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (isValidSecret) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '';

  // Bloqueio de clonadores: impede qualquer requisição de domínios não autorizados
  if (!pathname.includes('image-proxy.php')) {
    if (!isAllowedOrigin && !isValidSecret) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Acesso negado: Origem não autorizada.' }));
    }
  }

  // 1. Leads Status / Save
  if (pathname.includes('leads.php')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      forwardToRemote(req, res, req.url, body || null);
    });
    return;
  }

  // 2. HikerAPI compatibility (Instagram profile, following, posts)
  if (pathname.includes('hikerapi.php')) {
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
  if (pathname.includes('instagram.php')) {
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
        profile: {
          pk: '123456789',
          username: userParam,
          full_name: userParam.charAt(0).toUpperCase() + userParam.slice(1),
          biography: 'Conta ativa no Instagram',
          profile_pic_url: detectTargetGender(userParam) === 'female' ? '/fotos pessoas reais/mulher2.jpg' : '/fotos pessoas reais/homem1.jpg',
          is_private: false,
          is_verified: true,
          is_business: false,
          media_count: 36,
          follower_count: 1420,
          following_count: 310
        },
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
  if (pathname.includes('image-proxy.php')) {
    let target = parsedUrl.query.url;
    if (!target) {
      res.statusCode = 400;
      return res.end();
    }

    while (typeof target === 'string' && (target.startsWith('/api/proxy/image-proxy.php') || target.includes('image-proxy.php?url='))) {
      const idx = target.indexOf('url=');
      if (idx !== -1) {
        target = decodeURIComponent(target.substring(idx + 4));
      } else {
        break;
      }
    }

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

  forwardToRemote(req, res, req.url);
};
