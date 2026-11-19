// 玩法核心：只有格子、连弩、传送带、槽位，不画图。
// 手机里、浏览器里、node 机器人里跑的都是这一份。画面层只读 g 和 g.events。

const CFG = {
  speed: 22, // 传送带速度：格 / 秒（绕一圈约 6 秒）
  fireCd: 0.018, // 两发之间最少隔多久（秒）
  corner: 3, // 拐角算几格长
  perLane: 1, // 经过一列 / 一行，小连弩射几发（底子的规矩：一发）
  bigPerLane: 2, // 合体大连弩射两发
  beltCap: 3, // 传送带上最多几台（机器人量过：3 台时「会玩」和「乱点」差得最开，差一点也最多）
  gap: 3, // 两台连弩在传送带上至少隔几格
  merge: true, // 槽里同色三台合体
  rescue: true, // 槽满时刚好凑成三台也算救回来
};

// 颜色：字母 → 序号。关卡图里用字母画。
const ORDER = 'ROYGTBPK';

function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// scale = 每个字母画成几乘几的小格（2 = 像沙画那样细碎）
function parseArt(art, scale) {
  const z = scale || 1;
  const rows = art.map((r) => r.trim());
  const h0 = rows.length;
  const w0 = rows[0].length;
  const w = w0 * z;
  const h = h0 * z;
  const cells = new Int8Array(w * h).fill(-1);
  for (let y = 0; y < h0; y++) {
    if (rows[y].length !== w0) throw new Error('关卡图第 ' + (y + 1) + ' 行长度不对');
    for (let x = 0; x < w0; x++) {
      const k = ORDER.indexOf(rows[y][x]);
      if (k < 0) continue;
      for (let dy = 0; dy < z; dy++) for (let dx = 0; dx < z; dx++) cells[(y * z + dy) * w + x * z + dx] = k;
    }
  }
  return { w, h, cells };
}

// 每格「埋得多深」：四个方向里，挡在它前面最少有几格
function depthMap(cells, w, h) {
  const d = new Int16Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (cells[y * w + x] < 0) continue;
      let a = 0, b = 0, c = 0, e = 0;
      for (let k = y + 1; k < h; k++) if (cells[k * w + x] >= 0) a++;
      for (let k = y - 1; k >= 0; k--) if (cells[k * w + x] >= 0) b++;
      for (let k = x + 1; k < w; k++) if (cells[y * w + k] >= 0) c++;
      for (let k = x - 1; k >= 0; k--) if (cells[y * w + k] >= 0) e++;
      d[y * w + x] = Math.min(a, b, c, e);
    }
  return d;
}

// —— 传送带的形状：一圈圆角矩形，从左下角进，顺着「下 → 右 → 上 → 左」绕一圈 ——
function loopLen(w, h) {
  return 2 * w + 2 * h + 4 * CFG.corner;
}

// 第 s 格时正对着哪一条线（列或行），拐角处返回 null
function laneAt(s, w, h) {
  const C = CFG.corner;
  let t = s;
  if (t < C) return null;
  t -= C;
  if (t < w) return { dir: 0, k: Math.floor(t) }; // 下边，朝上打第 k 列
  t -= w;
  if (t < C) return null;
  t -= C;
  if (t < h) return { dir: 1, k: h - 1 - Math.floor(t) }; // 右边，朝左打第 k 行
  t -= h;
  if (t < C) return null;
  t -= C;
  if (t < w) return { dir: 2, k: w - 1 - Math.floor(t) }; // 上边，朝下
  t -= w;
  if (t < C) return null;
  t -= C;
  if (t < h) return { dir: 3, k: Math.floor(t) }; // 左边，朝右
  return null;
}

// 这条线上从外往里第一个还在的格子
function firstInLane(cells, w, h, dir, k) {
  if (dir === 0) {
    for (let y = h - 1; y >= 0; y--) if (cells[y * w + k] >= 0) return y * w + k;
  } else if (dir === 1) {
    for (let x = w - 1; x >= 0; x--) if (cells[k * w + x] >= 0) return k * w + x;
  } else if (dir === 2) {
    for (let y = 0; y < h; y++) if (cells[y * w + k] >= 0) return y * w + k;
  } else {
    for (let x = 0; x < w; x++) if (cells[k * w + x] >= 0) return k * w + x;
  }
  return -1;
}

// 画面用：传送带上第 s 格在哪（单位是格，棋盘左上角是 0,0），o = 传送带离棋盘多远
function beltPos(s, w, h, o) {
  const L = loopLen(w, h);
  let t = ((s % L) + L) % L;
  const arc = (cx, cy, a0, a1, f) => {
    const a = a0 + (a1 - a0) * f;
    return { x: cx + o * Math.cos(a), y: cy + o * Math.sin(a), dir: null };
  };
  const P = Math.PI;
  const C = CFG.corner;
  if (t < C) return arc(0, h, P, P / 2, t / C);
  t -= C;
  if (t < w) return { x: t, y: h + o, dir: 0 };
  t -= w;
  if (t < C) return arc(w, h, P / 2, 0, t / C);
  t -= C;
  if (t < h) return { x: w + o, y: h - t, dir: 1 };
  t -= h;
  if (t < C) return arc(w, 0, 0, -P / 2, t / C);
  t -= C;
  if (t < w) return { x: w - t, y: -o, dir: 2 };
  t -= w;
  if (t < C) return arc(0, 0, -P / 2, -P, t / C);
  t -= C;
  return { x: -o, y: t, dir: 3 };
}

// —— 一局 ——
// level: { w, h, cells, cols: [[{color, ammo}]], slots }
// opts: { extraSlots, dog（大连弩多转一圈）, turtle（槽满救一次） }
function createGame(level, opts) {
  opts = opts || {};
  const counts = new Array(ORDER.length).fill(0);
  let total = 0;
  for (let i = 0; i < level.cells.length; i++) {
    if (level.cells[i] >= 0) {
      counts[level.cells[i]]++;
      total++;
    }
  }
  let id = 1;
  const g = {
    w: level.w,
    h: level.h,
    L: loopLen(level.w, level.h),
    cells: new Int8Array(level.cells),
    counts,
    total,
    left: total,
    cols: level.cols.map((c) => c.map((s) => ({ id: id++, color: s.color, ammo: s.ammo, big: 0 }))),
    belt: [],
    entering: [],
    slots: new Array(level.slots + (opts.extraSlots || 0)).fill(null),
    time: 0,
    status: 'play', // play / win / full
    overflow: null,
    adsUsed: 0,
    turtle: opts.turtle ? 1 : 0,
    dog: !!opts.dog,
    events: [],
    taps: 0,
  };
  return g;
}

function onBelt(g) {
  return g.belt.length + g.entering.length;
}

function canLaunch(g) {
  return g.status === 'play' && onBelt(g) < CFG.beltCap;
}

function launch(g, s, from, i) {
  s.s = 0;
  s.cd = 0;
  s.lane = -1;
  s.laneShots = 0;
  s.extra = false;
  g.entering.push(s);
  g.taps++;
  g.events.push({ type: 'launch', from, i, sh: s });
}

function tapColumn(g, i) {
  const c = g.cols[i];
  if (!c || !c.length) return false;
  if (!canLaunch(g)) {
    g.events.push({ type: 'beltFull' });
    return false;
  }
  launch(g, c.shift(), 'col', i);
  return true;
}

function tapSlot(g, i) {
  const s = g.slots[i];
  if (!s) return false;
  if (!canLaunch(g)) {
    g.events.push({ type: 'beltFull' });
    return false;
  }
  g.slots[i] = null;
  launch(g, s, 'slot', i);
  return true;
}

function freeSlots(g) {
  let n = 0;
  for (const s of g.slots) if (!s) n++;
  return n;
}

// 槽里同色三台 → 合成一台大连弩（我们改的三成之一）
function mergeCheck(g) {
  if (!CFG.merge) return;
  let merged = true;
  while (merged) {
    merged = false;
    for (let c = 0; c < ORDER.length && !merged; c++) {
      const idx = [];
      g.slots.forEach((s, i) => s && s.color === c && idx.push(i));
      if (idx.length >= 3) {
        const [a, b, d] = idx;
        const parts = [g.slots[a], g.slots[b], g.slots[d]];
        const big = { id: parts[0].id, color: c, ammo: parts[0].ammo + parts[1].ammo + parts[2].ammo, big: Math.min(3, 1 + Math.max(parts[0].big, parts[1].big, parts[2].big)) };
        g.slots[a] = big;
        g.slots[b] = null;
        g.slots[d] = null;
        g.events.push({ type: 'merge', at: a, from: [b, d], sh: big });
        merged = true;
      }
    }
  }
}

function backToSlot(g, s) {
  const free = g.slots.indexOf(null);
  if (free >= 0) {
    g.slots[free] = s;
    g.events.push({ type: 'toSlot', at: free, sh: s });
    mergeCheck(g);
    if (freeSlots(g) <= 1) g.events.push({ type: 'warn', free: freeSlots(g) });
    return;
  }
  // 满了：能和槽里两台同色凑成三台，就当场合体，不算输
  const same = [];
  g.slots.forEach((x, i) => x && x.color === s.color && same.push(i));
  if (CFG.merge && CFG.rescue && same.length >= 2) {
    const [a, b] = same;
    const big = { id: s.id, color: s.color, ammo: s.ammo + g.slots[a].ammo + g.slots[b].ammo, big: Math.min(3, 1 + Math.max(s.big, g.slots[a].big, g.slots[b].big)) };
    g.slots[a] = big;
    g.slots[b] = null;
    g.events.push({ type: 'merge', at: a, from: [b], sh: big, rescue: true });
    return;
  }
  if (g.turtle > 0) {
    g.turtle--;
    g.slots.push(s);
    g.events.push({ type: 'turtle', at: g.slots.length - 1, sh: s });
    return;
  }
  g.status = 'full';
  g.overflow = s;
  g.events.push({ type: 'full', sh: s });
}

// 看广告：机关匣加一格，接着打
function adContinue(g) {
  if (g.status !== 'full' || !g.overflow) return false;
  g.slots.push(g.overflow);
  g.events.push({ type: 'toSlot', at: g.slots.length - 1, sh: g.overflow, ad: true });
  g.overflow = null;
  g.status = 'play';
  g.adsUsed++;
  mergeCheck(g);
  return true;
}

function step(g, dt) {
  if (g.status !== 'play') return;
  g.time += dt;
  // 排队的连弩：前面那台走开 gap 格才上
  if (g.entering.length) {
    let minS = Infinity;
    for (const b of g.belt) if (b.s < minS) minS = b.s;
    if (minS >= CFG.gap) g.belt.push(g.entering.shift());
  }
  for (let i = 0; i < g.belt.length; i++) {
    const s = g.belt[i];
    s.s += CFG.speed * dt;
    s.cd -= dt;
    if (s.s >= g.L) {
      if (g.dog && s.big && !s.extra) {
        s.s -= g.L;
        s.extra = true;
        g.events.push({ type: 'dogLap', sh: s });
        continue;
      }
      g.belt.splice(i, 1);
      i--;
      backToSlot(g, s);
      if (g.status !== 'play') return;
      continue;
    }
    if (s.cd > 0) continue;
    const ln = laneAt(s.s, g.w, g.h);
    if (!ln) continue;
    const key = ln.dir * 100 + ln.k;
    if (key !== s.lane) {
      s.lane = key;
      s.laneShots = 0;
    }
    if (s.laneShots >= (s.big ? CFG.bigPerLane : CFG.perLane)) continue;
    const idx = firstInLane(g.cells, g.w, g.h, ln.dir, ln.k);
    if (idx < 0 || g.cells[idx] !== s.color) continue;
    // 射中
    g.cells[idx] = -1;
    g.left--;
    g.counts[s.color]--;
    s.ammo--;
    s.laneShots++;
    s.cd = CFG.fireCd;
    g.events.push({ type: 'shot', idx, color: s.color, sh: s });
    if (g.counts[s.color] === 0) g.events.push({ type: 'colorClear', color: s.color });
    if (s.ammo <= 0) {
      g.belt.splice(i, 1);
      i--;
      g.events.push({ type: 'empty', sh: s });
    }
    if (g.left === 0) {
      g.status = 'win';
      g.events.push({ type: 'win' });
      return;
    }
  }
}

// —— 机器人 ——
// 估一估：这台连弩现在上去，绕一圈大概能射掉几格（不管别的连弩）
function estimate(g, s, scratch) {
  const c = scratch || new Int8Array(g.cells.length);
  c.set(g.cells);
  const perLane = s.big ? CFG.bigPerLane : CFG.perLane;
  let ammo = s.ammo;
  let hits = 0;
  const lanes = [
    [0, g.w, (j) => j],
    [1, g.h, (j) => g.h - 1 - j],
    [2, g.w, (j) => g.w - 1 - j],
    [3, g.h, (j) => j],
  ];
  for (const [dir, n, kf] of lanes) {
    for (let j = 0; j < n && ammo > 0; j++) {
      for (let r = 0; r < perLane && ammo > 0; r++) {
        const idx = firstInLane(c, g.w, g.h, dir, kf(j));
        if (idx < 0 || c[idx] !== s.color) break;
        c[idx] = -1;
        ammo--;
        hits++;
      }
    }
  }
  return hits;
}

// 挑下一步点哪台。noise = 有多大概率乱点（装成真人）
function botPick(g, rnd, noise) {
  if (!canLaunch(g)) return null;
  const cands = [];
  g.cols.forEach((c, i) => c.length && cands.push({ kind: 'col', i, s: c[0] }));
  g.slots.forEach((s, i) => s && cands.push({ kind: 'slot', i, s }));
  if (!cands.length) return null;
  const scratch = new Int8Array(g.cells.length);
  let best = null;
  for (const c of cands) {
    c.hits = estimate(g, c.s, scratch);
    c.score = c.hits >= c.s.ammo ? 1000 + c.hits : c.hits + (c.kind === 'slot' && c.hits > 0 ? 0.5 : 0);
    if (!best || c.score > best.score) best = c;
  }
  // 装成真人：失手时多半是「在打得到的几台里随手挑了一台」，偶尔才完全点错
  if (noise && rnd() < noise) {
    const ok = cands.filter((c) => c.hits > 0);
    if (ok.length && rnd() < 0.8) return ok[Math.floor(rnd() * ok.length)];
    return cands[Math.floor(rnd() * cands.length)];
  }
  if (best.hits > 0) return best;
  if (onBelt(g) > 0) return null; // 等传送带上的先把外层清掉
  // 谁都打不到：掀开一列，挑后面那台最有用的
  let dig = null;
  for (const c of cands) {
    if (c.kind !== 'col') continue;
    const next = g.cols[c.i][1];
    const v = next ? estimate(g, next, scratch) : -1;
    if (!dig || v > dig.v) dig = Object.assign(c, { v });
  }
  return dig || cands[0];
}

function botTap(g, pick) {
  return pick.kind === 'col' ? tapColumn(g, pick.i) : tapSlot(g, pick.i);
}

// 无头跑一局：返回 { win, time, left, total, taps }
function simulate(level, seed, opt) {
  opt = opt || {};
  const g = createGame(level, opt.gameOpts);
  const r = rng(seed);
  const dt = 1 / 30;
  const noise = opt.noise || 0;
  let wait = 0;
  while (g.status === 'play' && g.time < (opt.maxTime || 600)) {
    wait -= dt;
    if (wait <= 0) {
      const p = botPick(g, r, noise);
      if (p) {
        botTap(g, p);
        wait = (opt.react || 0.25) * (0.6 + r() * 0.8);
      } else wait = 0.1;
    }
    step(g, dt);
    g.events.length = 0;
  }
  return { win: g.status === 'win', time: g.time, left: g.left, total: g.total, taps: g.taps, free: freeSlots(g) };
}

// 闭眼乱点：能点就随便点一台（用来查「会玩和乱点差多少」，差得少 = 选择不重要 = 不好玩）
function simulateRandom(level, seed, opt) {
  opt = opt || {};
  const g = createGame(level, opt.gameOpts);
  const r = rng(seed);
  const dt = 1 / 30;
  let wait = 0;
  while (g.status === 'play' && g.time < 900) {
    wait -= dt;
    if (wait <= 0 && canLaunch(g)) {
      const c = [];
      g.cols.forEach((x, i) => x.length && c.push({ kind: 'col', i }));
      g.slots.forEach((x, i) => x && c.push({ kind: 'slot', i }));
      if (c.length) botTap(g, c[Math.floor(r() * c.length)]);
      wait = (opt.react || 0.6) * (0.6 + r() * 0.8);
    }
    step(g, dt);
    g.events.length = 0;
  }
  return { win: g.status === 'win', time: g.time, left: g.left, total: g.total };
}

// —— 给一张图就出一关 ——
// def: { art: [...字符串], cols: 列数, slots: 槽数, chunks: [每台子弹数可选值] }
// 数每种颜色多少格 → 拆成一台台连弩 → 洗牌发进几列 → 机器人试打一遍，保证有解
function buildLevel(def, seed) {
  // fill：把空白填成一种「图纸底色」。整张填满，里层颜色被外层挡住，才要想先放哪台（底子的核心压力）
  const art = def.fill ? def.art.map((r) => r.replace(/\./g, def.fill)) : def.art;
  const img = parseArt(art, def.scale || 2);
  const r = rng(seed);
  const counts = new Array(ORDER.length).fill(0);
  const depthSum = new Array(ORDER.length).fill(0);
  const dm = depthMap(img.cells, img.w, img.h);
  img.cells.forEach((c, i) => {
    if (c >= 0) {
      counts[c]++;
      depthSum[c] += dm[i];
    }
  });
  let maxDepth = 1;
  counts.forEach((n, c) => n && (maxDepth = Math.max(maxDepth, depthSum[c] / n)));
  const shooters = [];
  const chunks = def.chunks || [10, 20, 30, 40];
  const maxChunk = Math.max.apply(null, chunks);
  counts.forEach((n, color) => {
    while (n > 0) {
      let a = Math.min(n, chunks[Math.floor(r() * chunks.length)]);
      if (n - a > 0 && n - a < 10) a = n; // 别剩零头
      shooters.push({ color, ammo: a, depth: depthSum[color] / counts[color] / maxDepth });
      n -= a;
    }
  });
  // bury：越大，埋在里层的颜色越容易排在前面（越难）。机器人打不过就一点点放松
  let bury = def.bury || 0;
  let lvl = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    // tail < 0：子弹少的小连弩往后排 → 快清完时还剩好多台、一圈圈回槽堵车，输也输在最后一点（机器人量过：比反过来排「差一点」多一倍）
    const tail = def.tail === undefined ? -2 : def.tail;
    const keyed = shooters.map((s) => ({ s, key: r() - bury * s.depth + (tail * s.ammo) / maxChunk }));
    keyed.sort((a, b) => a.key - b.key);
    // 开局顺手：最前面 head 那几台按「先外层、后里层」重排，难处留到后半段
    const head = Math.round(keyed.length * (def.head === undefined ? 0.35 : def.head));
    const front = keyed.slice(0, head).sort((a, b) => a.s.depth - b.s.depth + (r() - 0.5) * 0.3);
    keyed.splice(0, head, ...front);
    const cols = [];
    for (let i = 0; i < def.cols; i++) cols.push([]);
    keyed.forEach((k, i) => cols[i % def.cols].push({ color: k.s.color, ammo: k.s.ammo }));
    lvl = { w: img.w, h: img.h, cells: img.cells, cols, slots: def.slots || 5, attempt, bury };
    if (def.noVerify) return lvl;
    const res = simulate(lvl, seed * 31 + attempt, { react: 0.2 });
    if (res.win) return lvl;
    bury *= 0.9;
  }
  return lvl;
}

module.exports = {
  CFG,
  ORDER,
  rng,
  parseArt,
  depthMap,
  loopLen,
  laneAt,
  firstInLane,
  beltPos,
  createGame,
  canLaunch,
  onBelt,
  tapColumn,
  tapSlot,
  freeSlots,
  adContinue,
  step,
  estimate,
  botPick,
  botTap,
  simulate,
  simulateRandom,
  buildLevel,
};
