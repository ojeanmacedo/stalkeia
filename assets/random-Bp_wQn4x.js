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

function detectTargetGender(targetUser = "", targetName = "") {
  let combined = `${targetName} ${targetUser}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!combined && typeof window !== "undefined") {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlUser = urlParams.get("username") || "";
      const p = JSON.parse(localStorage.getItem("instagram_profile") || "{}");
      const esp = localStorage.getItem("espionado_username") || localStorage.getItem("username") || "";
      combined = `${p.full_name || ""} ${p.username || ""} ${urlUser} ${esp}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    } catch (_) {}
  }

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

function L(count = 20, forcedGender = null) {
  const gender = forcedGender || detectTargetGender();
  const primaryList = gender === "female" ? REAL_MEN : REAL_WOMEN;
  const secondaryList = gender === "female" ? REAL_WOMEN : REAL_MEN;

  const result = [];
  let pIdx = 0;
  let sIdx = 0;

  // Os 3 primeiros (Melhores Amigos / conversas topo) são 100% do gênero oposto
  for (let i = 0; i < 3; i++) {
    const item = primaryList[pIdx % primaryList.length];
    pIdx++;
    result.push({
      ...item,
      pk: String(100000000 + result.length),
      id: String(100000000 + result.length),
      profile_pic_url_hd: item.profile_pic_url,
      follower_count: Math.floor(Math.random() * 2000 + 350),
      following_count: Math.floor(Math.random() * 800 + 150),
      media_count: Math.floor(Math.random() * 120 + 10)
    });
  }

  // Restante: aproximadamente 80% gênero oposto e 20% do mesmo gênero para composição realista
  while (result.length < count) {
    // 3 do gênero oposto para 1 do mesmo gênero
    for (let k = 0; k < 3 && result.length < count; k++) {
      const item = primaryList[pIdx % primaryList.length];
      pIdx++;
      result.push({
        ...item,
        pk: String(100000000 + result.length),
        id: String(100000000 + result.length),
        profile_pic_url_hd: item.profile_pic_url,
        follower_count: Math.floor(Math.random() * 2000 + 350),
        following_count: Math.floor(Math.random() * 800 + 150),
        media_count: Math.floor(Math.random() * 120 + 10)
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
        follower_count: Math.floor(Math.random() * 2000 + 350),
        following_count: Math.floor(Math.random() * 800 + 150),
        media_count: Math.floor(Math.random() * 120 + 10)
      });
    }
  }

  return result;
}

function A() {
  const a = ["password","senha123","minhavida","instagram","meuamor","familia","amordemae","brasil","minhasenha","segredo","meuperfil","secreto","favorito","minhafilha","meufilho"];
  const o = a[Math.floor(Math.random() * a.length)];
  const e = 9, r = 15, n = o.length, t = Math.max(0, e - n), s = r - n, u = Math.floor(Math.random() * (s - t + 1)) + t;
  let i = "";
  for (let m = 0; m < u; m++) {
    const f = Math.random();
    f < 0.5 ? i += Math.floor(Math.random() * 10) : f < 0.8 ? i += String.fromCharCode(97 + Math.floor(Math.random() * 26)) : i += "!@#$%&*"[Math.floor(Math.random() * 7)];
  }
  return o + i;
}

function R(a = 20) {
  return Array.from({ length: a }, () => A());
}

function organizeFriendsByGender(friendsList = [], targetUser = "", targetName = "") {
  const targetGender = detectTargetGender(targetUser, targetName);
  const desiredGender = targetGender === "female" ? "male" : "female";

  if (!Array.isArray(friendsList) || friendsList.length === 0) {
    return L(25, targetGender);
  }

  const isMockList = friendsList.some((f) => f?.profile_pic_url?.includes("/fotos pessoas reais/"));
  if (isMockList) {
    return L(25, targetGender);
  }

  // Lista de amigos reais da API do Instagram
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

  // 1. Top 3 (Melhores Amigos / conversas topo): prioriza amigos reais do gênero oposto
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

export { L as a, R as g, detectTargetGender as d, REAL_MEN as m, REAL_WOMEN as w, organizeFriendsByGender as o };
