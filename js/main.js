// 主程序：画面、点按、特效、失败页、过关、画册。规则全在 core.js。
const P = require('./platform.js');
const core = require('./core.js');
const LV = require('./levels.js');
const ART = require('./illust.js');

const COLORS = {
  R: ['#e5484d', '#ff9a9c', '#9c2228'],
  O: ['#f2994a', '#ffcf9a', '#a85a1a'],
  Y: ['#f5cf4c', '#fff3a8', '#a8851a'],
  G: ['#56c271', '#a8f0b4', '#2a7a40'],
  T: ['#3fc1c9', '#a6f2f5', '#1d7a80'],
  B: ['#4a7cf0', '#a6c2ff', '#2445a0'],
  P: ['#9b6bdc', '#d6b8ff', '#5a3a98'],
  K: ['#f27fb2', '#ffc6e0', '#a83d70'],
};
const COL = core.ORDER.split('').map((k) => ({ base: COLORS[k][0], light: COLORS[k][1], dark: COLORS[k][2] }));
const INK = '#1a1220';
const BRASS = '#d9a54c';
const BRASS_D = '#8a5f26';
const BRASS_L = '#f5d58c';
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const STEP = 1 / 60;
const SAVE_KEY = 'cjg_save_v1';
const BUY_COST = 30;
const MAX_ADS = 3;

const PETS = [
  { id: 'que', name: '铜雀', desc: '过关金币多一半', at: 0 },
  { id: 'dog', name: '木犬', desc: '合体大连弩多转一圈', at: 2 },
  { id: 'turtle', name: '蒸汽龟', desc: '每局槽满时救你一次', at: 5 },
];

const scr = P.setup(onTouch);
const ctx = scr.ctx;
const W = scr.width;
const H = scr.height;
const DPR = scr.dpr;

const save = Object.assign({ level: 0, coins: 0, album: [], pets: {}, buy: false, plays: 0, hinted: false, newAlbum: false }, P.load(SAVE_KEY) || {});
function persist() {
  P.save(SAVE_KEY, save);
}

const S = {
  time: 0,
  timeScale: 1, // 测试机器人用：快进
  g: null,
  L: null,
  def: null,
  levelNo: 0,
  cover: null,
  coverCtx: null,
  illus: null,
  acc: 0,
  hitstop: 0,
  endT: 0,
  revealT: -1,
  reward: null,
  adsThisRound: 0,
  ad: null,
  toast: null,
  album: { open: false, bio: [false, false] },
  buttons: [],
  bullets: [],
  parts: [],
  rings: [],
  ghosts: [],
  floaters: [],
  shake: 0,
  flash: 0,
  slotFlash: 0,
  beltFlash: 0,
  combo: 0,
  lastPop: 0,
  lastShotT: 0,
  stats: { rounds: [], restarts: [], lastEnd: null },
};

// —— 布局 ——
function layout(w, h) {
  const top = Math.max(10, scr.safeTop + 6);
  const barH = 40;
  const o = 2.3; // 传送带离棋盘几格
  const across = w + 2 * o + 2.4;
  const cs = Math.max(4, Math.floor(Math.min((W - 20) / across, (H * 0.47) / (h + 2 * o + 2.4))));
  const bw = cs * w;
  const bh = cs * h;
  const bx = Math.round((W - bw) / 2);
  const by = Math.round(top + barH + (o + 1.4) * cs + 4);
  const cartR = Math.max(10, cs * 1.4);
  const beltBottom = by + bh + o * cs;
  const slotR = Math.min(22, Math.max(16, W / 20));
  const slotY = beltBottom + cartR + slotR + 30;
  const colTop = slotY + slotR + 22;
  return { top, barH, o, cs, bw, bh, bx, by, cartR, slotR, slotY, colTop, beltBottom };
}

function slotPos(i, n) {
  const sp = Math.min(60, (W - 40) / Math.max(n, 1));
  return { x: W / 2 + (i - (n - 1) / 2) * sp, y: S.L.slotY };
}

function colX(c, n) {
  const cw = Math.min(88, (W - 24) / n);
  return W / 2 + (c - (n - 1) / 2) * cw;
}

function colItemY(j) {
  const L = S.L;
  const room = H - 20 - (L.colTop + 34);
  const sp = Math.max(34, Math.min(50, room / 5.2));
  return L.colTop + 34 + (j === 0 ? 0 : sp * 0.35 + j * sp);
}

function cellCenter(idx) {
  const g = S.g;
  const L = S.L;
  const x = idx % g.w;
  const y = Math.floor(idx / g.w);
  return { x: L.bx + (x + 0.5) * L.cs, y: L.by + (y + 0.5) * L.cs };
}

function beltXY(s) {
  const g = S.g;
  const L = S.L;
  const p = core.beltPos(s, g.w, g.h, L.o);
  let ang;
  if (p.dir === 0) ang = -Math.PI / 2;
  else if (p.dir === 1) ang = Math.PI;
  else if (p.dir === 2) ang = Math.PI / 2;
  else if (p.dir === 3) ang = 0;
  else {
    const cx = p.x < g.w / 2 ? 0 : g.w;
    const cy = p.y < g.h / 2 ? 0 : g.h;
    ang = Math.atan2(cy - p.y, cx - p.x);
  }
  return { x: L.bx + p.x * L.cs, y: L.by + p.y * L.cs, ang };
}

// —— 开一局 ——
const illusCache = {};
function startLevel() {
  const n = save.level;
  S.levelNo = n;
  S.def = LV.levelDef(n);
  const seed = (save.plays * 7919 + n * 104729 + 13) >>> 0;
  const lvl = core.buildLevel(S.def, seed);
  const opts = { extraSlots: save.buy ? 1 : 0, dog: !!save.pets.dog, turtle: !!save.pets.turtle };
  save.buy = false;
  save.plays++;
  persist();
  S.g = core.createGame(lvl, opts);
  S.L = layout(lvl.w, lvl.h);
  S.acc = 0;
  S.hitstop = 0;
  S.endT = 0;
  S.revealT = -1;
  S.reward = null;
  S.adsThisRound = 0;
  S.bullets = [];
  S.parts = [];
  S.rings = [];
  S.ghosts = [];
  S.floaters = [];
  S.shake = 0;
  S.flash = 0;
  S.combo = 0;
  buildCover();
  const key = (n % ART.COUNT) + '_' + S.L.bw;
  if (!illusCache[key]) {
    const c = P.offscreen(S.L.bw * DPR, S.L.bh * DPR);
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    ART.draw(x, n % ART.COUNT, S.L.bw);
    illusCache[key] = c;
  }
  S.illus = illusCache[key];
  if (S.stats.lastEnd !== null) S.stats.restarts.push(S.time - S.stats.lastEnd);
  S.stats.lastEnd = null;
  S.roundStart = S.time;
}

// 盖在插画上的一层：蓝图纸 + 敌方机关的像素。射掉一格就在这层上挖一个洞，底下的插画露出来
function buildCover() {
  const L = S.L;
  const g = S.g;
  S.cover = P.offscreen(L.bw * DPR, L.bh * DPR);
  const c = S.cover.getContext('2d');
  c.scale(DPR, DPR);
  S.coverCtx = c;
  c.fillStyle = '#1f3456';
  c.fillRect(0, 0, L.bw, L.bh);
  c.strokeStyle = 'rgba(140,180,230,0.13)';
  c.lineWidth = 1;
  for (let i = 0; i <= g.w; i += 2) {
    c.beginPath();
    c.moveTo(i * L.cs + 0.5, 0);
    c.lineTo(i * L.cs + 0.5, L.bh);
    c.stroke();
  }
  for (let i = 0; i <= g.h; i += 2) {
    c.beginPath();
    c.moveTo(0, i * L.cs + 0.5);
    c.lineTo(L.bw, i * L.cs + 0.5);
    c.stroke();
  }
  c.strokeStyle = 'rgba(160,200,240,0.28)';
  c.strokeRect(L.cs * 1.5, L.cs * 1.5, L.bw - L.cs * 3, L.bh - L.cs * 3);
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] >= 0) drawCell(c, i, g.cells[i]);
}

function drawCell(c, idx, color) {
  const L = S.L;
  const g = S.g;
  const cx = idx % g.w;
  const cy = Math.floor(idx / g.w);
  const x = cx * L.cs;
  const y = cy * L.cs;
  const k = COL[color];
  const e = Math.max(1, Math.round(L.cs * 0.22));
  const same = (dx, dy) => {
    const nx = cx + dx;
    const ny = cy + dy;
    return nx >= 0 && ny >= 0 && nx < g.w && ny < g.h && g.cells[ny * g.w + nx] === color;
  };
  c.fillStyle = k.base;
  c.fillRect(x, y, L.cs, L.cs);
  // 只在图形边上描：上、左亮边，下、右暗边（赛璐璐的硬阴影）
  c.fillStyle = k.light;
  if (!same(0, -1)) c.fillRect(x, y, L.cs, e);
  if (!same(-1, 0)) c.fillRect(x, y, e, L.cs);
  c.fillStyle = k.dark;
  if (!same(0, 1)) c.fillRect(x, y + L.cs - e, L.cs, e);
  if (!same(1, 0)) c.fillRect(x + L.cs - e, y, e, L.cs);
  // 细细的沙粒感
  if ((cx * 7 + cy * 13) % 5 === 0) {
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(x + L.cs * 0.3, y + L.cs * 0.3, Math.max(1, L.cs * 0.25), Math.max(1, L.cs * 0.25));
  }
}

function clearCell(idx) {
  const L = S.L;
  const g = S.g;
  S.coverCtx.clearRect((idx % g.w) * L.cs, Math.floor(idx / g.w) * L.cs, L.cs, L.cs);
}

// —— 规则那边吐出来的事件 → 画面和声音 ——
function onEvent(e) {
  const g = S.g;
  switch (e.type) {
    case 'shot': {
      const from = beltXY(e.sh.s);
      const to = cellCenter(e.idx);
      S.bullets.push({ x0: from.x + Math.cos(from.ang) * S.L.cartR, y0: from.y + Math.sin(from.ang) * S.L.cartR, x1: to.x, y1: to.y, t: 0, dur: 0.07, color: e.color, idx: e.idx });
      S.lastShotT = S.time;
      break;
    }
    case 'launch': {
      const sh = e.sh;
      if (e.from === 'col') sh.from = { x: colX(e.i, g.cols.length), y: colItemY(0) };
      else sh.from = slotPos(e.i, g.slots.length);
      sh.flyT = 0;
      S.rings.push({ x: sh.from.x, y: sh.from.y, r0: 10, r1: 34, t: 0, dur: 0.25, color: COL[sh.color].light });
      P.sound('launch', 0.5);
      P.vibrate(false);
      if (!save.hinted) {
        save.hinted = true;
        persist();
      }
      break;
    }
    case 'empty': {
      const p = beltXY(e.sh.s);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        S.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 40, life: 0.6, max: 0.6, color: '#ece6dc', size: 5 + Math.random() * 4, soft: true });
      }
      S.rings.push({ x: p.x, y: p.y, r0: 8, r1: 30, t: 0, dur: 0.3, color: '#fff3c4' });
      P.sound('empty', 0.5);
      break;
    }
    case 'toSlot': {
      const sh = e.sh;
      sh.from = sh.lastXY ? { x: sh.lastXY.x, y: sh.lastXY.y } : slotPos(e.at, g.slots.length);
      sh.flyT = 0;
      P.sound('slot', 0.5);
      break;
    }
    case 'warn':
      S.slotFlash = 0.8;
      P.sound('warn', 0.5);
      break;
    case 'merge': {
      const to = slotPos(e.at, g.slots.length);
      for (const fi of e.from) {
        const f = slotPos(fi, g.slots.length);
        S.ghosts.push({ x0: f.x, y0: f.y, x1: to.x, y1: to.y, t: 0, dur: 0.18, color: e.sh.color });
      }
      e.sh.flyT = 0.18;
      e.sh.popT = 0;
      S.hitstop = 0.06;
      S.shake = Math.max(S.shake, 4);
      S.flash = Math.max(S.flash, 0.25);
      S.rings.push({ x: to.x, y: to.y, r0: 10, r1: 70, t: 0, dur: 0.4, color: COL[e.sh.color].light });
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        S.parts.push({ x: to.x, y: to.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.5, max: 0.5, color: COL[e.sh.color].base, size: 5 });
      }
      P.sound('merge', 0.7);
      P.vibrate(true);
      break;
    }
    case 'colorClear': {
      S.shake = Math.max(S.shake, 6);
      S.hitstop = Math.max(S.hitstop, 0.08);
      const L = S.L;
      S.rings.push({ x: L.bx + L.bw / 2, y: L.by + L.bh / 2, r0: 20, r1: L.bw * 0.8, t: 0, dur: 0.5, color: COL[e.color].light });
      P.sound('clear', 0.6);
      break;
    }
    case 'win':
      S.stats.rounds.push({ win: true, time: S.time - S.roundStart, left: 0, level: S.levelNo });
      giveReward(true);
      break;
    case 'full':
      S.stats.rounds.push({ win: false, time: S.time - S.roundStart, left: g.left / g.total, level: S.levelNo });
      giveReward(false);
      S.shake = 8;
      P.sound('lose', 0.6);
      P.vibrate(true);
      break;
    case 'turtle':
    case 'dogLap': {
      const p = e.type === 'turtle' ? slotPos(e.at, g.slots.length) : beltXY(e.sh.s);
      S.floaters.push({ x: p.x, y: p.y - 20, pet: e.type === 'turtle' ? 'turtle' : 'dog', t: 0 });
      P.sound('pet', 0.6);
      break;
    }
    case 'beltFull':
      S.beltFlash = 0.5;
      P.sound('nope', 0.5);
      break;
  }
}

function giveReward(win) {
  const g = S.g;
  const n = S.levelNo;
  const r = { win, coins: 0, pet: null, scene: n % ART.COUNT, pageDone: false, doubled: false };
  if (win) {
    r.coins = 20 + 5 * Math.min(n, 10);
    if (save.pets.que) r.coins = Math.round(r.coins * 1.5);
    if (!save.album[r.scene]) {
      save.album[r.scene] = true;
      save.newAlbum = true;
      const page = Math.floor(r.scene / 4);
      r.pageDone = [0, 1, 2, 3].every((k) => save.album[page * 4 + k]);
    }
    for (const p of PETS) {
      if (p.at === n && !save.pets[p.id]) {
        save.pets[p.id] = true;
        r.pet = p;
      }
    }
  } else {
    r.coins = 3 + Math.floor((1 - g.left / g.total) * 10);
  }
  save.coins += r.coins;
  persist();
  S.reward = r;
}

// —— 每帧 ——
function update(dt) {
  dt *= S.timeScale;
  S.time += dt;
  if (S.toast) {
    S.toast.t -= dt;
    if (S.toast.t <= 0) S.toast = null;
  }
  if (S.ad) {
    S.ad.t -= dt;
    if (S.ad.t <= 0) {
      const cb = S.ad.cb;
      S.ad = null;
      cb();
    }
    return;
  }
  const g = S.g;
  // 特效
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.t += dt;
    if (b.t >= b.dur) {
      S.bullets.splice(i, 1);
      clearCell(b.idx);
      const k = COL[b.color];
      for (let j = 0; j < 3; j++) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 90;
        S.parts.push({ x: b.x1, y: b.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.45, max: 0.45, color: j ? k.base : k.light, size: S.L.cs * 0.55 });
      }
      if (S.time - S.lastPop > 0.028) {
        S.combo = S.time - S.lastPop < 0.25 ? Math.min(11, S.combo + 1) : 0;
        S.lastPop = S.time;
        P.sound('pop' + Math.floor(S.combo), 0.35);
      }
    }
  }
  for (let i = S.parts.length - 1; i >= 0; i--) {
    const p = S.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      S.parts.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.soft ? -20 : 420) * dt;
  }
  for (const list of [S.rings, S.ghosts, S.floaters]) {
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].t += dt;
      if (list[i].t >= (list[i].dur || 0.9)) list.splice(i, 1);
    }
  }
  S.shake = Math.max(0, S.shake - dt * 30);
  S.flash = Math.max(0, S.flash - dt * 2.5);
  S.slotFlash = Math.max(0, S.slotFlash - dt);
  S.beltFlash = Math.max(0, S.beltFlash - dt);
  if (!g) return;
  for (const sh of allShooters()) {
    if (sh.flyT !== undefined) sh.flyT += dt;
    if (sh.popT !== undefined) sh.popT += dt;
  }
  if (S.album.open) return;
  if (S.hitstop > 0) {
    S.hitstop -= dt;
  } else if (g.status === 'play') {
    S.acc += dt;
    while (S.acc >= STEP) {
      core.step(g, STEP);
      S.acc -= STEP;
      for (const e of g.events) onEvent(e);
      g.events.length = 0;
      if (g.status !== 'play') break;
    }
  }
  for (const e of g.events) onEvent(e);
  g.events.length = 0;
  if (g.status !== 'play') {
    S.endT += dt;
    if (g.status === 'win' && S.revealT < 0 && S.bullets.length === 0) {
      S.revealT = 0;
      S.flash = 0.6;
      S.hitstop = 0.15;
      P.sound('win', 0.7);
      setTimeout0(() => P.sound('reveal', 0.6), 300);
    }
    if (S.revealT >= 0) S.revealT += dt;
    if (S.stats.lastEnd === null) S.stats.lastEnd = S.time;
  }
}

let pendingTimers = [];
function setTimeout0(fn, ms) {
  pendingTimers.push({ at: S.time + ms / 1000, fn });
}
function runTimers() {
  for (let i = pendingTimers.length - 1; i >= 0; i--) {
    if (S.time >= pendingTimers[i].at) {
      const f = pendingTimers[i].fn;
      pendingTimers.splice(i, 1);
      f();
    }
  }
}

function allShooters() {
  const g = S.g;
  const out = [];
  for (const s of g.belt) out.push(s);
  for (const s of g.entering) out.push(s);
  for (const s of g.slots) if (s) out.push(s);
  return out;
}

// —— 画 ——
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function text(str, x, y, size, color, align, stroke) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = Math.max(2, size / 5);
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function coinIcon(x, y, r) {
  circle(x, y, r);
  ctx.fillStyle = '#f5cf4c';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = '#a8851a';
  ctx.fillRect(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6);
}

// 一台蒸汽连弩车
function drawShooter(x, y, r, sh, ang, alpha) {
  const k = COL[sh.color];
  const big = sh.big || 0;
  r *= 1 + 0.16 * big;
  if (sh.popT !== undefined && sh.popT < 0.3) r *= 1 + 0.35 * Math.sin((sh.popT / 0.3) * Math.PI);
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(x, y);
  // 合体大连弩：外面一圈转动的齿轮
  if (big) {
    ctx.save();
    ctx.rotate(S.time * 2.5);
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const q = i % 2 === 0 ? r * 1.22 : r * 1.02;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
      ctx.lineTo(Math.cos(a + Math.PI / teeth) * q, Math.sin(a + Math.PI / teeth) * q);
    }
    ctx.closePath();
    ctx.fillStyle = BRASS_L;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }
  // 弩口
  ctx.save();
  ctx.rotate(ang === undefined ? -Math.PI / 2 : ang);
  ctx.fillStyle = BRASS_D;
  ctx.fillRect(r * 0.5, -r * 0.22, r * 0.75, r * 0.44);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.strokeRect(r * 0.5, -r * 0.22, r * 0.75, r * 0.44);
  ctx.restore();
  // 铜座
  circle(0, 0, r);
  ctx.fillStyle = BRASS;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // 颜色核心
  circle(0, 0, r * 0.76);
  ctx.fillStyle = k.base;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, Math.PI * 1.05, Math.PI * 1.6);
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = k.light;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, Math.PI * 0.1, Math.PI * 0.75);
  ctx.strokeStyle = k.dark;
  ctx.stroke();
  // 子弹数
  text(String(sh.ammo), 0, 1, Math.round(r * (sh.ammo >= 100 ? 0.62 : 0.8)), '#fff', 'center', INK);
  ctx.restore();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
function ease(t) {
  t = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - t, 3);
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#22171f');
  g.addColorStop(1, '#120d14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.07;
  ART.gear(ctx, W * 0.1, H * 0.62, W * 0.3, 14, BRASS, S.time * 0.1, 2);
  ART.gear(ctx, W * 0.95, H * 0.85, W * 0.22, 11, BRASS, -S.time * 0.14, 2);
  ctx.globalAlpha = 1;
}

function drawTopBar() {
  const L = S.L;
  const g = S.g;
  const y = L.top + L.barH / 2;
  // 第几关
  rr(12, y - 15, 74, 30, 15);
  ctx.fillStyle = '#2e2128';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = BRASS_D;
  ctx.stroke();
  text('第 ' + (S.levelNo + 1) + ' 关', 49, y + 1, 15, BRASS_L);
  // 进度条
  const px = 98;
  const pw = W - px - 128;
  rr(px, y - 7, pw, 14, 7);
  ctx.fillStyle = '#2e2128';
  ctx.fill();
  const f = 1 - g.left / g.total;
  if (f > 0) {
    rr(px, y - 7, Math.max(14, pw * f), 14, 7);
    ctx.fillStyle = BRASS;
    ctx.fill();
  }
  rr(px, y - 7, pw, 14, 7);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 金币
  coinIcon(W - 108, y, 9);
  text(String(save.coins), W - 95, y + 1, 15, '#fff3c4', 'left');
  // 画册按钮
  const bx = W - 34;
  rr(bx - 18, y - 16, 36, 32, 8);
  ctx.fillStyle = '#6b3a2a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f2e6cc';
  ctx.fillRect(bx - 11, y - 10, 9, 20);
  ctx.fillRect(bx + 2, y - 10, 9, 20);
  ctx.fillStyle = BRASS;
  ctx.fillRect(bx - 1, y - 11, 2, 22);
  if (save.newAlbum) {
    circle(bx + 15, y - 14, 5);
    ctx.fillStyle = '#ff4d4d';
    ctx.fill();
  }
  S.buttons.push({ id: 'album', x: bx - 22, y: y - 20, w: 44, h: 40, fn: openAlbum });
}

function drawBoard() {
  const L = S.L;
  const g = S.g;
  // 铜框
  rr(L.bx - 6, L.by - 6, L.bw + 12, L.bh + 12, 6);
  ctx.fillStyle = BRASS_D;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  for (const [x, y] of [[L.bx - 3, L.by - 3], [L.bx + L.bw + 3, L.by - 3], [L.bx - 3, L.by + L.bh + 3], [L.bx + L.bw + 3, L.by + L.bh + 3]]) {
    circle(x, y, 2.5);
    ctx.fillStyle = BRASS_L;
    ctx.fill();
  }
  ctx.drawImage(S.illus, L.bx, L.by, L.bw, L.bh);
  // 过关：剩下的蓝图纸从中间往外烧开，整张插画露出来
  if (S.revealT >= 0) {
    const t = ease(S.revealT / 0.9);
    if (t < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.bx, L.by, L.bw, L.bh);
      ctx.arc(L.bx + L.bw / 2, L.by + L.bh / 2, t * L.bw * 0.75, 0, Math.PI * 2, true);
      ctx.clip('evenodd');
      ctx.drawImage(S.cover, L.bx, L.by, L.bw, L.bh);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(L.bx + L.bw / 2, L.by + L.bh / 2, t * L.bw * 0.75, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,220,140,' + (1 - t) + ')';
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.bx, L.by, L.bw, L.bh);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(L.bx + L.bw / 2, L.by + L.bh / 2, t * L.bw * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.drawImage(S.cover, L.bx, L.by, L.bw, L.bh);
  }
}

function drawBelt() {
  const L = S.L;
  const g = S.g;
  const x0 = L.bx - L.o * L.cs;
  const y0 = L.by - L.o * L.cs;
  const bw = L.bw + 2 * L.o * L.cs;
  const bh = L.bh + 2 * L.o * L.cs;
  const r0 = L.o * L.cs;
  const band = L.cartR * 2 + 2;
  rr(x0, y0, bw, bh, r0);
  ctx.lineWidth = band + 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.lineWidth = band;
  ctx.strokeStyle = '#2f242c';
  ctx.stroke();
  // 履带纹：跟着传送带一起走
  ctx.save();
  ctx.setLineDash([3, L.cs * 1.4]);
  ctx.lineDashOffset = -S.time * core.CFG.speed * L.cs;
  ctx.lineWidth = band - 8;
  ctx.strokeStyle = '#3d3038';
  ctx.stroke();
  ctx.restore();
  for (const d of [band / 2, -band / 2]) {
    rr(x0 - d, y0 - d, bw + 2 * d, bh + 2 * d, Math.max(2, r0 + d));
    ctx.lineWidth = 3;
    ctx.strokeStyle = BRASS;
    ctx.stroke();
  }
  // 入口：小灯 = 传送带上已经有几台
  const cap = core.CFG.beltCap;
  const ey = L.by + L.bh + L.o * L.cs + band / 2 + 13;
  for (let i = 0; i < cap; i++) {
    const on = i < core.onBelt(g);
    circle(W / 2 + (i - (cap - 1) / 2) * 15, ey, 5);
    ctx.fillStyle = on ? (S.beltFlash > 0 && Math.floor(S.time * 12) % 2 ? '#ff6b6b' : '#ffcf6b') : '#3a2c33';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // 传送带上的连弩
  for (const sh of g.belt) {
    const p = beltXY(sh.s);
    sh.lastXY = p;
    let x = p.x;
    let y = p.y;
    if (sh.from && sh.flyT < 0.16) {
      const t = ease(sh.flyT / 0.16);
      x = lerp(sh.from.x, x, t);
      y = lerp(sh.from.y, y, t);
    }
    drawShooter(x, y, L.cartR, sh, p.ang);
  }
  for (let i = 0; i < g.entering.length; i++) {
    const sh = g.entering[i];
    const p = beltXY(0);
    const t = sh.from ? ease((sh.flyT || 0) / 0.16) : 1;
    drawShooter(lerp(sh.from ? sh.from.x : p.x, p.x - 4 * i, t), lerp(sh.from ? sh.from.y : p.y, p.y + 6 * i, t), L.cartR, sh, -Math.PI / 2, 0.85);
  }
}

function drawSlots() {
  const L = S.L;
  const g = S.g;
  const n = g.slots.length;
  const free = core.freeSlots(g);
  const danger = (free <= 1 && g.status === 'play') || g.status === 'full';
  for (let i = 0; i < n; i++) {
    const p = slotPos(i, n);
    rr(p.x - L.slotR - 4, p.y - L.slotR - 4, L.slotR * 2 + 8, L.slotR * 2 + 8, 10);
    ctx.fillStyle = '#1a1217';
    ctx.fill();
    ctx.lineWidth = 3;
    const blink = danger && Math.floor(S.time * 6) % 2 === 0;
    ctx.strokeStyle = blink && !g.slots[i] ? '#ff5a5a' : danger ? '#b84a3a' : BRASS_D;
    ctx.stroke();
    if (S.slotFlash > 0 && !g.slots[i]) {
      ctx.fillStyle = 'rgba(255,80,80,' + S.slotFlash * 0.4 + ')';
      ctx.fill();
    }
  }
  for (let i = 0; i < n; i++) {
    const sh = g.slots[i];
    if (!sh) continue;
    const p = slotPos(i, n);
    let x = p.x;
    let y = p.y;
    if (sh.from && sh.flyT < 0.2) {
      const t = ease(sh.flyT / 0.2);
      x = lerp(sh.from.x, x, t);
      y = lerp(sh.from.y, y, t);
    }
    drawShooter(x, y, L.slotR * 0.92, sh);
  }
  // 合体时飞过去的两台
  for (const gh of S.ghosts) {
    const t = ease(gh.t / gh.dur);
    drawShooter(lerp(gh.x0, gh.x1, t), lerp(gh.y0, gh.y1, t), L.slotR * 0.9 * (1 - t * 0.5), { color: gh.color, ammo: '', big: 0 }, undefined, 1 - t * 0.5);
  }
  // 槽满了：多出来的那台悬在上面发抖
  if (g.status === 'full' && g.overflow) {
    const p = slotPos(n - 1, n);
    const sx = Math.sin(S.time * 50) * 3;
    drawShooter(p.x + L.slotR * 2.3 + sx, p.y, L.slotR * 0.92, g.overflow);
    text('✕', p.x + L.slotR * 2.3 + sx + 14, p.y - 16, 18, '#ff5a5a', 'center', INK);
  }
}

function drawColumns() {
  const L = S.L;
  const g = S.g;
  const n = g.cols.length;
  const can = core.canLaunch(g);
  for (let c = 0; c < n; c++) {
    const x = colX(c, n);
    const list = g.cols[c];
    // 底槽
    rr(x - 36, L.colTop, 72, H - L.colTop - 14, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    for (let j = Math.min(list.length, 5) - 1; j >= 0; j--) {
      const sh = list[j];
      const y = colItemY(j);
      const bob = j === 0 ? Math.sin(S.time * 4 + c) * 1.5 : 0;
      const r = j === 0 ? 28 : 21 - j * 1.5;
      drawShooter(x, y + bob, r, sh, -Math.PI / 2, j === 0 ? (can ? 1 : 0.6) : 0.75 - j * 0.12);
    }
    if (list.length > 5) text('+' + (list.length - 5), x, colItemY(5) - 6, 12, '#8a7a80');
  }
  // 第一关的手势：点最前面那台
  if (!save.hinted && g.status === 'play' && S.levelNo === 0) {
    const x = colX(0, n);
    const y = colItemY(0);
    const t = (S.time % 1.2) / 1.2;
    const press = t < 0.3 ? t / 0.3 : t < 0.5 ? 1 : 1 - (t - 0.5) / 0.7;
    drawHand(x + 18, y + 30 - press * 10, press);
  }
}

function drawHand(x, y, press) {
  ctx.save();
  ctx.translate(x, y);
  if (press > 0.8) {
    circle(-10, -14, 18 + (1 - press) * 20);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }
  ctx.fillStyle = '#fff3e0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  rr(-6, -14, 12, 30, 6);
  ctx.fill();
  ctx.stroke();
  rr(-6, 4, 26, 26, 9);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFx() {
  for (const b of S.bullets) {
    const t = b.t / b.dur;
    const x = lerp(b.x0, b.x1, t);
    const y = lerp(b.y0, b.y1, t);
    ctx.lineWidth = 3;
    ctx.strokeStyle = COL[b.color].light;
    ctx.beginPath();
    ctx.moveTo(lerp(b.x0, b.x1, Math.max(0, t - 0.35)), lerp(b.y0, b.y1, Math.max(0, t - 0.35)));
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  for (const p of S.parts) {
    const a = p.life / p.max;
    ctx.globalAlpha = p.soft ? a * 0.7 : Math.min(1, a * 1.6);
    ctx.fillStyle = p.color;
    const s = p.size * (p.soft ? 1.4 - a * 0.4 : 0.6 + a * 0.4);
    if (p.soft) {
      circle(p.x, p.y, s / 2);
      ctx.fill();
    } else ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  for (const r of S.rings) {
    const t = r.t / r.dur;
    circle(r.x, r.y, lerp(r.r0, r.r1, ease(t)));
    ctx.lineWidth = 4 * (1 - t) + 1;
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = 1 - t;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const f of S.floaters) {
    const t = f.t / 0.9;
    ctx.globalAlpha = 1 - t;
    petIcon(f.pet, f.x, f.y - t * 30, 26);
  }
  ctx.globalAlpha = 1;
}

function petIcon(id, x, y, s) {
  if (id === 'que') {
    ART.bird(ctx, x, y, s, 0);
  } else if (id === 'dog') {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#a0683a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    rr(-s * 0.45, -s * 0.15, s * 0.8, s * 0.4, 4);
    ctx.fill();
    ctx.stroke();
    rr(s * 0.15, -s * 0.45, s * 0.35, s * 0.35, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6b4630';
    ctx.fillRect(-s * 0.4, s * 0.25, s * 0.12, s * 0.2);
    ctx.fillRect(s * 0.15, s * 0.25, s * 0.12, s * 0.2);
    ctx.fillStyle = INK;
    ctx.fillRect(s * 0.33, -s * 0.33, s * 0.06, s * 0.06);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#7aa86a';
    ctx.beginPath();
    ctx.arc(0, s * 0.1, s * 0.42, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    circle(s * 0.5, s * 0.02, s * 0.14);
    ctx.fill();
    ctx.stroke();
    ART.gear(ctx, 0, -s * 0.08, s * 0.16, 7, BRASS, S.time, 1.2);
    ctx.globalAlpha *= 0.7;
    circle(-s * 0.1, -s * 0.5, s * 0.1);
    ctx.fillStyle = '#ece6dc';
    ctx.fill();
    ctx.restore();
  }
}

function button(id, x, y, w, h, label, kind, fn, sub) {
  rr(x, y, w, h, h / 2);
  ctx.fillStyle = kind === 'primary' ? '#f2b84b' : kind === 'ad' ? '#3fa66b' : '#3a2c33';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (kind === 'primary' || kind === 'ad') {
    rr(x + 4, y + 3, w - 8, h * 0.38, h * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
  }
  text(label, x + w / 2, y + h / 2 + (sub ? -7 : 1), kind === 'primary' ? Math.min(22, h * 0.42) : Math.min(17, h * 0.38), kind === 'primary' ? INK : '#fff');
  if (sub) text(sub, x + w / 2, y + h / 2 + 11, 11, kind === 'primary' ? '#5a3a1a' : '#d8f5e0');
  S.buttons.push({ id, x, y, w, h, fn });
}

function sheet(y) {
  rr(12, y, W - 24, H - y - 14, 22);
  ctx.fillStyle = 'rgba(28,20,26,0.96)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = BRASS_D;
  ctx.stroke();
}

function drawFailPanel() {
  const g = S.g;
  if (S.endT < 0.6) return;
  const t = ease((S.endT - 0.6) / 0.25);
  const y0 = lerp(H, S.L.slotY + S.L.slotR + 14, t);
  sheet(y0);
  const left = g.left / g.total;
  const pct = Math.max(1, Math.round(left * 100));
  const near = left <= 0.25;
  text(near ? '差一点！' : '再试一次', W / 2, y0 + 30, 18, near ? '#ffcf6b' : '#c9b8c0');
  text('还剩 ' + pct + '%', W / 2, y0 + 66, 34, '#fff', 'center', INK);
  // 进度条：差多少一眼看见
  const bw = W - 100;
  rr(50, y0 + 92, bw, 14, 7);
  ctx.fillStyle = '#2e2128';
  ctx.fill();
  rr(50, y0 + 92, Math.max(14, bw * (1 - left)), 14, 7);
  ctx.fillStyle = BRASS;
  ctx.fill();
  if (S.reward) {
    coinIcon(W / 2 - 18, y0 + 124, 8);
    text('+' + S.reward.coins, W / 2 - 4, y0 + 125, 14, '#fff3c4', 'left');
  }
  let by = y0 + 146;
  const bwid = W - 80;
  if (S.adsThisRound < MAX_ADS) {
    button('adSlot', 40, by, bwid, 48, '📺 机关匣加一格，接着打', 'ad', () => showAd(() => {
      S.adsThisRound++;
      core.adContinue(g);
      S.endT = 0;
      S.stats.rounds.pop();
      S.stats.lastEnd = null;
      // 退回失败时给的金币，免得白拿
      if (S.reward) save.coins -= S.reward.coins;
      S.reward = null;
      persist();
    }));
    by += 60;
  }
  button('retry', 40, by, bwid, 58, '↻ 再来', 'primary', retry);
  by += 70;
  drawBuyToggle(by);
}

function drawBuyToggle(y) {
  if (y > H - 40) return;
  const on = save.buy;
  const label = on ? '✓ 下局多一格槽（已买）' : '下局多一格槽';
  const w = 220;
  const x = W / 2 - w / 2;
  rr(x, y, w, 34, 17);
  ctx.fillStyle = on ? '#4a3a22' : '#2a1f26';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = on ? BRASS : '#4a3a42';
  ctx.stroke();
  text(label, x + w / 2 - (on ? 0 : 18), y + 18, 13, on ? BRASS_L : '#d8c8d0');
  if (!on) {
    coinIcon(x + w - 46, y + 17, 7);
    text(String(BUY_COST), x + w - 36, y + 18, 13, '#fff3c4', 'left');
  }
  S.buttons.push({
    id: 'buy',
    x,
    y,
    w,
    h: 34,
    fn: () => {
      if (save.buy) return;
      if (save.coins < BUY_COST) {
        S.toast = { text: '金币不够，再打几局', t: 1.5 };
        return;
      }
      save.coins -= BUY_COST;
      save.buy = true;
      P.sound('coin', 0.5);
      persist();
    },
  });
}

function drawWinPanel() {
  if (S.revealT < 1.0) return;
  const r = S.reward;
  const t = ease((S.revealT - 1.0) / 0.25);
  const y0 = lerp(H, S.L.slotY - S.L.slotR - 12, t);
  sheet(y0);
  // 画册 +1：缩略图 + 这一页的进度
  const th = 74;
  const tx = 36;
  ctx.drawImage(S.illus, tx, y0 + 20, th, th);
  ctx.lineWidth = 3;
  ctx.strokeStyle = BRASS;
  ctx.strokeRect(tx, y0 + 20, th, th);
  text('画册 +1', tx + th + 18, y0 + 34, 20, '#ffcf6b', 'left');
  text('「' + ART.CAPTIONS[r.scene] + '」', tx + th + 14, y0 + 62, 15, '#e8dcc8', 'left');
  const page = Math.floor(r.scene / 4);
  for (let k = 0; k < 4; k++) {
    rr(tx + th + 20 + k * 22, y0 + 80, 16, 12, 3);
    ctx.fillStyle = save.album[page * 4 + k] ? BRASS : '#3a2c33';
    ctx.fill();
  }
  let y = y0 + 112;
  if (r.pageDone) {
    text('集齐一页！画册里解锁一段小传', W / 2, y + 4, 14, '#9fe3e0');
    y += 26;
  }
  if (r.pet) {
    petIcon(r.pet.id, 56, y + 14, 28);
    text('新伙伴 ' + r.pet.name + '：' + r.pet.desc, 80, y + 15, 14, '#fff', 'left');
    y += 36;
  }
  coinIcon(W / 2 - 22, y + 10, 9);
  text('+' + r.coins + (r.doubled ? '（翻倍）' : ''), W / 2 - 8, y + 11, 17, '#fff3c4', 'left');
  y += 30;
  const bwid = W - 80;
  if (!r.doubled && S.adsThisRound < MAX_ADS) {
    button('adCoins', 40, y, bwid, 44, '📺 金币翻倍', 'ad', () => showAd(() => {
      S.adsThisRound++;
      save.coins += r.coins;
      r.coins *= 2;
      r.doubled = true;
      P.sound('coin', 0.6);
      persist();
    }));
    y += 56;
  }
  button('next', 40, y, bwid, 58, '下一关 ▶', 'primary', nextLevel);
}

function showAd(cb) {
  S.ad = { t: 3, cb };
}

function drawAd() {
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, W, H);
  text('广告占位', W / 2, H / 2 - 20, 22, '#fff');
  text(String(Math.ceil(S.ad.t)), W / 2, H / 2 + 24, 40, '#ffcf6b');
  text('（原型不接真广告，3 秒后自动给奖励）', W / 2, H / 2 + 70, 12, '#9a8a90');
}

function retry() {
  P.sound('launch', 0.4);
  startLevel();
}

function nextLevel() {
  save.level++;
  persist();
  P.sound('launch', 0.4);
  startLevel();
}

function openAlbum() {
  S.album.open = true;
  save.newAlbum = false;
  persist();
}

const thumbCache = {};
function thumb(i, s) {
  const key = i + '_' + s;
  if (!thumbCache[key]) {
    const c = P.offscreen(s * DPR, s * DPR);
    const x = c.getContext('2d');
    x.scale(DPR, DPR);
    ART.draw(x, i, s);
    thumbCache[key] = c;
  }
  return thumbCache[key];
}

function wrapText(str, x, y, maxW, size, color, lh) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  let lineStr = '';
  for (const ch of str) {
    if (ctx.measureText(lineStr + ch).width > maxW) {
      ctx.fillText(lineStr, x, y);
      y += lh;
      lineStr = ch;
    } else lineStr += ch;
  }
  if (lineStr) {
    ctx.fillText(lineStr, x, y);
    y += lh;
  }
  return y;
}

function drawAlbum() {
  ctx.fillStyle = 'rgba(18,12,18,0.985)';
  ctx.fillRect(0, 0, W, H);
  const top = S.L.top;
  text('画册', W / 2, top + 22, 22, '#ffcf6b');
  button('closeAlbum', W - 56, top + 4, 40, 36, '✕', 'plain', () => (S.album.open = false));
  let y = top + 52;
  const ts = Math.min(78, (W - 60) / 4 - 8);
  ART.PAGES.forEach((pg, p) => {
    text('第 ' + (p + 1) + ' 页 · ' + pg.title, 20, y + 10, 15, '#e8dcc8', 'left');
    y += 24;
    for (let k = 0; k < 4; k++) {
      const i = p * 4 + k;
      const x = 20 + k * (ts + 8);
      if (save.album[i]) ctx.drawImage(thumb(i, ts), x, y, ts, ts);
      else {
        ctx.fillStyle = '#241a20';
        ctx.fillRect(x, y, ts, ts);
        text('?', x + ts / 2, y + ts / 2, 26, '#4a3a42');
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = save.album[i] ? BRASS : '#3a2c33';
      ctx.strokeRect(x, y, ts, ts);
    }
    y += ts + 8;
    const done = [0, 1, 2, 3].every((k) => save.album[p * 4 + k]);
    if (done) {
      const open = S.album.bio[p];
      const lbl = (open ? '▾ ' : '▸ ') + '小传：' + pg.bioTitle;
      text(lbl, 20, y + 10, 14, '#9fe3e0', 'left');
      S.buttons.push({ id: 'bio' + p, x: 14, y: y - 4, w: 200, h: 28, fn: () => (S.album.bio[p] = !S.album.bio[p]) });
      y += 24;
      if (open) y = wrapText(pg.bio, 24, y, W - 48, 13, '#d8ccd4', 20) + 6;
    } else {
      text('集齐四格解锁一段小传', 20, y + 10, 12, '#6a5a62', 'left');
      y += 24;
    }
    y += 8;
  });
  text('机关伙伴', 20, y + 10, 15, '#e8dcc8', 'left');
  y += 30;
  PETS.forEach((p, i) => {
    const got = save.pets[p.id];
    const x = 20;
    const yy = y + i * 44;
    rr(x, yy, W - 40, 38, 10);
    ctx.fillStyle = got ? '#2e2128' : '#1c1419';
    ctx.fill();
    ctx.globalAlpha = got ? 1 : 0.25;
    petIcon(p.id, x + 24, yy + 19, 24);
    ctx.globalAlpha = 1;
    text(got ? p.name : '？？？', x + 48, yy + 13, 14, got ? '#fff' : '#6a5a62', 'left');
    text(got ? p.desc : '第 ' + (p.at + 1) + ' 关过关时得到', x + 48, yy + 29, 12, got ? '#c9b8c0' : '#5a4a52', 'left');
  });
}

function render() {
  S.buttons = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawBackground();
  if (!S.g) return;
  ctx.save();
  if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);
  drawBelt();
  drawBoard();
  drawSlots();
  drawColumns();
  drawFx();
  ctx.restore();
  drawTopBar();
  if (S.flash > 0) {
    ctx.fillStyle = 'rgba(255,248,220,' + S.flash * 0.5 + ')';
    ctx.fillRect(0, 0, W, H);
  }
  if (S.g.status === 'full') drawFailPanel();
  if (S.g.status === 'win') drawWinPanel();
  if (S.album.open) drawAlbum();
  if (S.toast) {
    rr(W / 2 - 120, H * 0.42, 240, 40, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fill();
    text(S.toast.text, W / 2, H * 0.42 + 21, 15, '#fff');
  }
  if (S.ad) drawAd();
}

// —— 点按 ——
function onTouch(type, id, x, y) {
  if (type !== 'down') return;
  if (S.ad) return;
  for (let i = S.buttons.length - 1; i >= 0; i--) {
    const b = S.buttons[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      b.fn();
      return;
    }
  }
  if (S.album.open) return;
  const g = S.g;
  if (!g || g.status !== 'play') return;
  const L = S.L;
  // 槽位
  const n = g.slots.length;
  for (let i = 0; i < n; i++) {
    const p = slotPos(i, n);
    if (Math.abs(x - p.x) < L.slotR + 8 && Math.abs(y - p.y) < L.slotR + 10) {
      if (g.slots[i]) core.tapSlot(g, i);
      return;
    }
  }
  // 下面几列：点这一列哪里都算点最前面那台
  if (y > L.colTop - 10) {
    const nc = g.cols.length;
    const cw = Math.min(88, (W - 24) / nc);
    for (let c = 0; c < nc; c++) {
      if (Math.abs(x - colX(c, nc)) < cw / 2) {
        core.tapColumn(g, c);
        return;
      }
    }
  }
}

// —— 跑起来 ——
let last = P.now();
function frame() {
  const t = P.now();
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  runTimers();
  render();
  P.nextFrame(frame);
}

startLevel();
frame();

P.exposeForTest('__cjg', {
  S,
  save,
  core,
  LV,
  W,
  H,
  startLevel,
  retry,
  nextLevel,
  tapCol: (i) => core.tapColumn(S.g, i),
  tapSlot: (i) => core.tapSlot(S.g, i),
  slotPos,
  colX,
  colItemY,
  persist,
});
