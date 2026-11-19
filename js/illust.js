// 清完一关露出的连载插画（占位：代码画的简单场景，赛璐璐平涂 + 深色描边）。
// 画册：四格一页，集齐一页解锁一段小传（局外，可折叠不看）。
// 以后换正式插画：draw(i) 换成画一张图片就行，别的不动。

const C = {
  ink: '#1a1220',
  night: '#141b2d',
  night2: '#24304d',
  brass: '#d9a54c',
  brassD: '#9a6b2a',
  brassL: '#f5d58c',
  copper: '#c26a3d',
  steam: '#ece6dc',
  lamp: '#ffcf6b',
  mercury: '#a8ece8',
  skin: '#f2c9a0',
  hair: '#2a1a22',
  jacket: '#3f6170',
  jacketD: '#2b4450',
  apron: '#7a4a2a',
  red: '#d9484d',
  wood: '#6b4630',
  woodD: '#4a2f20',
};

const PAGES = [
  {
    title: '熬夜造一只铜雀',
    bioTitle: '汐娘',
    bio: '汐娘以前给方士炼丹，跟水银打了半辈子交道。逃出地宫后，她在机关城的后坊落了脚：别人怕水银，她拿它当润滑、当镜子、当会流的零件。她话不多，手很快。夜里后坊最亮的那盏灯，是她的。',
  },
  {
    title: '城门那一夜',
    bioTitle: '那一夜',
    bio: '攻城机关长龙撞到第三道城门那晚，阿铸在城头守了一夜，以为守不住了。天快亮时，一只铜雀从后坊的方向飞来，撞进长龙的眼睛。阿铸后来才知道，那只铜雀是汐娘一夜没睡造出来的。最后一格画的是很久以前：墨非、汐娘、阿铸从秦陵地宫一路往上爬，看见了第一缕光。',
  },
];

const CAPTIONS = ['后坊亮着灯', '水银会流', '流水线上的铜雀', '飞去城墙', '长龙到了城下', '铜雀来了', '天亮了', '很久以前'];

function line(ctx, w) {
  ctx.lineWidth = w;
  ctx.strokeStyle = C.ink;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function sky(ctx, S, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
}

function stars(ctx, S, n, seed) {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = '#fff6d8';
  for (let i = 0; i < n; i++) {
    const x = r() * S;
    const y = r() * S * 0.5;
    const z = r() < 0.2 ? 2 : 1;
    ctx.globalAlpha = 0.4 + r() * 0.6;
    ctx.fillRect(x, y, z * S / 200, z * S / 200);
  }
  ctx.globalAlpha = 1;
}

function gear(ctx, cx, cy, r, teeth, fill, rot, lw) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot || 0);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.8;
    const a2 = a + Math.PI / teeth;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    ctx.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  line(ctx, lw);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.restore();
}

function puff(ctx, x, y, r, a) {
  ctx.globalAlpha = a === undefined ? 0.85 : a;
  ctx.fillStyle = C.steam;
  for (const [dx, dy, k] of [[0, 0, 1], [r * 0.8, r * 0.2, 0.75], [-r * 0.8, r * 0.25, 0.7], [r * 0.3, -r * 0.5, 0.7]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 汐娘：护目镜推在额头上、发髻插一根铜簪、卷起袖子、工具带。s = 身高
function xiniang(ctx, x, y, s, pose) {
  const u = s / 10;
  const lw = Math.max(1.5, u * 0.35);
  ctx.save();
  ctx.translate(x, y);
  // 腿 / 裤
  ctx.fillStyle = C.jacketD;
  ctx.beginPath();
  ctx.moveTo(-1.6 * u, 0);
  ctx.lineTo(-1.2 * u, -3.2 * u);
  ctx.lineTo(1.2 * u, -3.2 * u);
  ctx.lineTo(1.6 * u, 0);
  ctx.closePath();
  ctx.fill();
  line(ctx, lw);
  ctx.stroke();
  // 身子（短上衣）
  ctx.fillStyle = C.jacket;
  ctx.beginPath();
  ctx.moveTo(-1.7 * u, -3 * u);
  ctx.lineTo(-1.4 * u, -6.4 * u);
  ctx.lineTo(1.4 * u, -6.4 * u);
  ctx.lineTo(1.7 * u, -3 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 工具带
  ctx.fillStyle = C.apron;
  ctx.fillRect(-1.75 * u, -3.6 * u, 3.5 * u, 0.7 * u);
  ctx.strokeRect(-1.75 * u, -3.6 * u, 3.5 * u, 0.7 * u);
  ctx.fillStyle = C.brass;
  ctx.fillRect(-0.3 * u, -3.55 * u, 0.6 * u, 0.6 * u);
  ctx.fillRect(0.9 * u, -3.4 * u, 0.4 * u, 1.1 * u); // 挂着的扳手
  // 手臂（卷袖子：前臂露出皮肤）
  const arm = (sx, raise) => {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = u * 0.95;
    ctx.beginPath();
    ctx.moveTo(sx * 1.4 * u, -6 * u);
    const ex = sx * (raise ? 2.2 : 1.9) * u;
    const ey = raise ? -7.4 * u : -4.4 * u;
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = C.jacket;
    ctx.lineWidth = u * 0.6;
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = u * 0.8;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    const hx = sx * (raise ? 2.6 : 2.0) * u;
    const hy = raise ? -8.8 * u : -3.2 * u;
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = C.skin;
    ctx.lineWidth = u * 0.45;
    ctx.stroke();
    return [hx, hy];
  };
  arm(-1, false);
  const hand = arm(1, pose === 'work');
  if (pose === 'work') {
    // 手里一颗水银珠
    ctx.fillStyle = C.mercury;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1] - 0.6 * u, 0.6 * u, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, lw * 0.7);
    ctx.stroke();
  }
  // 头
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(0, -7.6 * u, 1.25 * u, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, lw);
  ctx.stroke();
  // 头发 + 发髻 + 铜簪
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(0, -7.9 * u, 1.3 * u, Math.PI * 1.02, Math.PI * 1.98);
  ctx.lineTo(1.25 * u, -7.4 * u);
  ctx.lineTo(-1.25 * u, -7.4 * u);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.6 * u, -9.2 * u, 0.7 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = u * 0.22;
  ctx.beginPath();
  ctx.moveTo(-0.3 * u, -9.9 * u);
  ctx.lineTo(1.6 * u, -8.7 * u);
  ctx.stroke();
  // 护目镜（推在额头）
  for (const gx of [-0.55, 0.55]) {
    ctx.fillStyle = C.brass;
    ctx.beginPath();
    ctx.arc(gx * 0.85 * u, -9.0 * u, 0.4 * u, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, lw * 0.6);
    ctx.stroke();
    ctx.fillStyle = C.mercury;
    ctx.beginPath();
    ctx.arc(gx * 0.85 * u, -9.0 * u, 0.22 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  // 眼睛
  ctx.fillStyle = C.ink;
  ctx.fillRect(-0.62 * u, -7.7 * u, 0.28 * u, 0.42 * u);
  ctx.fillRect(0.34 * u, -7.7 * u, 0.28 * u, 0.42 * u);
  ctx.fillStyle = '#e88a8a';
  ctx.fillRect(-0.9 * u, -7.15 * u, 0.35 * u, 0.18 * u);
  ctx.fillRect(0.55 * u, -7.15 * u, 0.35 * u, 0.18 * u);
  ctx.restore();
}

// 阿铸：宽肩、扛铜锤
function azhu(ctx, x, y, s) {
  const u = s / 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#5a3a2a';
  ctx.beginPath();
  ctx.moveTo(-2.4 * u, 0);
  ctx.lineTo(-2.8 * u, -6.5 * u);
  ctx.lineTo(2.8 * u, -6.5 * u);
  ctx.lineTo(2.4 * u, 0);
  ctx.closePath();
  ctx.fill();
  line(ctx, Math.max(1.5, u * 0.35));
  ctx.stroke();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(0, -7.8 * u, 1.4 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.hair;
  ctx.fillRect(-1.4 * u, -9.3 * u, 2.8 * u, 0.9 * u);
  // 铜锤
  ctx.strokeStyle = C.woodD;
  ctx.lineWidth = u * 0.5;
  ctx.beginPath();
  ctx.moveTo(2.2 * u, -5 * u);
  ctx.lineTo(3.8 * u, -10 * u);
  ctx.stroke();
  ctx.fillStyle = C.copper;
  ctx.fillRect(2.6 * u, -11.6 * u, 2.6 * u, 1.8 * u);
  line(ctx, Math.max(1.5, u * 0.35));
  ctx.strokeRect(2.6 * u, -11.6 * u, 2.6 * u, 1.8 * u);
  ctx.restore();
}

// 铜雀：黄铜小鸟，齿轮翅膀
function bird(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  const u = s / 10;
  ctx.fillStyle = C.brass;
  ctx.beginPath();
  ctx.ellipse(0, 0, 4 * u, 2.4 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, Math.max(1.2, u * 0.4));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4 * u, -0.5 * u);
  ctx.lineTo(6 * u, 0.2 * u);
  ctx.lineTo(4 * u, 0.9 * u);
  ctx.fillStyle = C.copper;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-3.6 * u, 0);
  ctx.lineTo(-6.5 * u, -1.6 * u);
  ctx.lineTo(-6 * u, 1 * u);
  ctx.closePath();
  ctx.fillStyle = C.brassD;
  ctx.fill();
  ctx.stroke();
  gear(ctx, -0.5 * u, -1.8 * u, 2.6 * u, 8, C.brassL, 0.3, Math.max(1, u * 0.3));
  ctx.fillStyle = C.mercury;
  ctx.beginPath();
  ctx.arc(2.4 * u, -0.5 * u, 0.6 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wall(ctx, S, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, S, S - y);
  const m = S / 12;
  for (let x = 0; x < S; x += m * 2) ctx.fillRect(x, y - m * 0.6, m, m * 0.6);
  line(ctx, S / 160);
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let x = 0; x < S; x += m * 2) {
    ctx.lineTo(x, y);
    ctx.lineTo(x, y - m * 0.6);
    ctx.lineTo(x + m, y - m * 0.6);
    ctx.lineTo(x + m, y);
  }
  ctx.lineTo(S, y);
  ctx.stroke();
}

function dragon(ctx, S, x, y, k, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.fillStyle = '#2b2a36';
  ctx.beginPath();
  ctx.moveTo(-S * 0.5, S * 0.1);
  ctx.quadraticCurveTo(-S * 0.2, -S * 0.25, S * 0.1, -S * 0.2);
  ctx.lineTo(S * 0.35, -S * 0.32);
  ctx.lineTo(S * 0.3, -S * 0.18);
  ctx.lineTo(S * 0.45, -S * 0.1);
  ctx.lineTo(S * 0.2, -S * 0.02);
  ctx.quadraticCurveTo(-S * 0.1, S * 0.05, -S * 0.5, S * 0.3);
  ctx.closePath();
  ctx.fill();
  line(ctx, S / 120);
  ctx.stroke();
  for (let i = 0; i < 5; i++) gear(ctx, -S * 0.35 + i * S * 0.08, S * 0.05 - i * S * 0.04, S * 0.03, 6, '#4a4656', i, S / 200);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(S * 0.22, -S * 0.17, S * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SCENES = [
  // 0 后坊亮着灯
  (ctx, S) => {
    sky(ctx, S, C.night, C.night2);
    stars(ctx, S, 40, 7);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(S * 0.8, S * 0.18, S * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2236';
    for (let i = 0; i < 6; i++) ctx.fillRect(i * S * 0.18 - S * 0.05, S * (0.55 - (i % 3) * 0.05), S * 0.16, S);
    // 工坊
    ctx.fillStyle = C.wood;
    ctx.fillRect(S * 0.2, S * 0.45, S * 0.55, S * 0.4);
    line(ctx, S / 100);
    ctx.strokeRect(S * 0.2, S * 0.45, S * 0.55, S * 0.4);
    ctx.fillStyle = C.woodD;
    ctx.beginPath();
    ctx.moveTo(S * 0.15, S * 0.46);
    ctx.lineTo(S * 0.475, S * 0.3);
    ctx.lineTo(S * 0.8, S * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.brass;
    ctx.fillRect(S * 0.62, S * 0.22, S * 0.07, S * 0.18);
    ctx.strokeRect(S * 0.62, S * 0.22, S * 0.07, S * 0.18);
    puff(ctx, S * 0.66, S * 0.17, S * 0.05);
    puff(ctx, S * 0.72, S * 0.09, S * 0.04, 0.6);
    ctx.fillStyle = C.lamp;
    ctx.fillRect(S * 0.28, S * 0.55, S * 0.14, S * 0.12);
    ctx.fillRect(S * 0.52, S * 0.55, S * 0.14, S * 0.12);
    ctx.strokeRect(S * 0.28, S * 0.55, S * 0.14, S * 0.12);
    ctx.strokeRect(S * 0.52, S * 0.55, S * 0.14, S * 0.12);
    gear(ctx, S * 0.24, S * 0.82, S * 0.08, 10, C.brass, 0.2, S / 120);
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, S * 0.86, S, S * 0.14);
    xiniang(ctx, S * 0.35, S * 0.665, S * 0.1, 'stand');
  },
  // 1 水银会流
  (ctx, S) => {
    sky(ctx, S, '#3a2a24', '#1d1418');
    const g = ctx.createRadialGradient(S * 0.5, S * 0.3, 0, S * 0.5, S * 0.3, S * 0.6);
    g.addColorStop(0, 'rgba(255,207,107,0.55)');
    g.addColorStop(1, 'rgba(255,207,107,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    gear(ctx, S * 0.12, S * 0.2, S * 0.12, 12, C.brassD, 0.1, S / 120);
    gear(ctx, S * 0.88, S * 0.32, S * 0.09, 10, C.brassD, 0.4, S / 120);
    // 工作台
    ctx.fillStyle = C.wood;
    ctx.fillRect(S * 0.05, S * 0.72, S * 0.9, S * 0.08);
    line(ctx, S / 100);
    ctx.strokeRect(S * 0.05, S * 0.72, S * 0.9, S * 0.08);
    ctx.fillStyle = C.woodD;
    ctx.fillRect(S * 0.1, S * 0.8, S * 0.05, S * 0.2);
    ctx.fillRect(S * 0.85, S * 0.8, S * 0.05, S * 0.2);
    xiniang(ctx, S * 0.42, S * 0.72, S * 0.48, 'work');
    // 飘起来的水银珠
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      const x = S * (0.6 + 0.18 * Math.cos(a));
      const y = S * (0.32 + 0.14 * Math.sin(a * 1.3));
      ctx.fillStyle = C.mercury;
      ctx.beginPath();
      ctx.arc(x, y, S * (0.012 + (i % 3) * 0.006), 0, Math.PI * 2);
      ctx.fill();
      line(ctx, S / 260);
      ctx.stroke();
    }
    // 台上的灯
    ctx.fillStyle = C.lamp;
    ctx.beginPath();
    ctx.arc(S * 0.8, S * 0.66, S * 0.04, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, S / 160);
    ctx.stroke();
  },
  // 2 流水线上的铜雀
  (ctx, S) => {
    sky(ctx, S, '#2b2230', '#171019');
    gear(ctx, S * 0.25, S * 0.25, S * 0.2, 14, '#5a4632', 0.05, S / 120);
    gear(ctx, S * 0.62, S * 0.18, S * 0.13, 11, '#5a4632', 0.3, S / 120);
    gear(ctx, S * 0.85, S * 0.38, S * 0.1, 9, '#5a4632', 0.7, S / 120);
    // 传送带
    ctx.fillStyle = '#2a2028';
    ctx.fillRect(0, S * 0.62, S, S * 0.1);
    line(ctx, S / 100);
    ctx.strokeRect(-2, S * 0.62, S + 4, S * 0.1);
    ctx.fillStyle = C.brass;
    for (let x = 0; x < S; x += S / 10) {
      ctx.beginPath();
      ctx.arc(x + S / 20, S * 0.67, S * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // 零件
    gear(ctx, S * 0.15, S * 0.58, S * 0.04, 8, C.copper, 0, S / 160);
    ctx.fillStyle = C.brassL;
    ctx.fillRect(S * 0.3, S * 0.55, S * 0.08, S * 0.06);
    ctx.strokeRect(S * 0.3, S * 0.55, S * 0.08, S * 0.06);
    bird(ctx, S * 0.6, S * 0.54, S * 0.12, 0);
    puff(ctx, S * 0.75, S * 0.48, S * 0.04, 0.5);
    xiniang(ctx, S * 0.85, S * 0.92, S * 0.26, 'stand');
    ctx.fillStyle = '#0f0b10';
    ctx.fillRect(0, S * 0.92, S, S * 0.08);
  },
  // 3 飞去城墙
  (ctx, S) => {
    sky(ctx, S, '#1a2440', '#3a3a5c');
    stars(ctx, S, 30, 11);
    ctx.fillStyle = '#2a3048';
    ctx.fillRect(0, S * 0.72, S, S * 0.3);
    wall(ctx, S, S * 0.74, '#3a3446');
    // 窗框
    ctx.strokeStyle = C.woodD;
    ctx.lineWidth = S * 0.05;
    ctx.strokeRect(S * 0.03, S * 0.03, S * 0.94, S * 0.94);
    ctx.lineWidth = S * 0.02;
    ctx.beginPath();
    ctx.moveTo(S * 0.5, S * 0.03);
    ctx.lineTo(S * 0.5, S * 0.97);
    ctx.stroke();
    // 尾迹
    ctx.strokeStyle = 'rgba(255,207,107,0.7)';
    ctx.lineWidth = S * 0.012;
    ctx.setLineDash([S * 0.03, S * 0.02]);
    ctx.beginPath();
    ctx.moveTo(S * 0.2, S * 0.8);
    ctx.quadraticCurveTo(S * 0.35, S * 0.35, S * 0.68, S * 0.4);
    ctx.stroke();
    ctx.setLineDash([]);
    bird(ctx, S * 0.7, S * 0.4, S * 0.13, -0.15);
  },
  // 4 长龙到了城下
  (ctx, S) => {
    sky(ctx, S, '#2a1424', '#5a2a2a');
    ctx.fillStyle = 'rgba(255,120,60,0.25)';
    ctx.fillRect(0, S * 0.5, S, S * 0.5);
    dragon(ctx, S, S * 0.45, S * 0.55, 1.1, '#ff4040');
    wall(ctx, S, S * 0.72, '#4a3a3a');
    azhu(ctx, S * 0.3, S * 0.72, S * 0.2);
    ctx.fillStyle = '#1a0f12';
    ctx.fillRect(0, S * 0.9, S, S * 0.1);
  },
  // 5 铜雀来了
  (ctx, S) => {
    sky(ctx, S, '#2a1a34', '#6a3a3a');
    dragon(ctx, S, S * 0.5, S * 0.55, 1.1, '#fff2a0');
    const g = ctx.createRadialGradient(S * 0.74, S * 0.36, 0, S * 0.74, S * 0.36, S * 0.25);
    g.addColorStop(0, 'rgba(255,240,180,0.95)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    bird(ctx, S * 0.7, S * 0.38, S * 0.11, 0.5);
    wall(ctx, S, S * 0.74, '#4a3a3a');
    azhu(ctx, S * 0.25, S * 0.74, S * 0.2);
  },
  // 6 天亮了
  (ctx, S) => {
    sky(ctx, S, '#ffd9a0', '#f2a46a');
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(S * 0.7, 0);
    ctx.lineTo(S, 0);
    ctx.lineTo(S * 0.5, S);
    ctx.lineTo(S * 0.2, S);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.wood;
    ctx.fillRect(0, S * 0.65, S, S * 0.1);
    line(ctx, S / 100);
    ctx.strokeRect(-2, S * 0.65, S + 4, S * 0.1);
    // 趴在桌上睡着的汐娘（头 + 手臂）
    ctx.fillStyle = C.jacket;
    ctx.beginPath();
    ctx.ellipse(S * 0.42, S * 0.63, S * 0.2, S * 0.07, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.hair;
    ctx.beginPath();
    ctx.arc(S * 0.42, S * 0.57, S * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(S * 0.47, S * 0.49, S * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = S * 0.012;
    ctx.beginPath();
    ctx.moveTo(S * 0.42, S * 0.47);
    ctx.lineTo(S * 0.54, S * 0.51);
    ctx.stroke();
    bird(ctx, S * 0.7, S * 0.6, S * 0.08, 0);
    puff(ctx, S * 0.2, S * 0.5, S * 0.05, 0.5);
    ctx.fillStyle = C.ink;
    ctx.font = `bold ${Math.round(S * 0.06)}px sans-serif`;
    ctx.fillText('z', S * 0.55, S * 0.42);
    ctx.fillText('z', S * 0.6, S * 0.35);
  },
  // 7 很久以前（祖师页：地宫水墨）
  (ctx, S) => {
    sky(ctx, S, '#e9e4d8', '#b9b2a4');
    const g = ctx.createRadialGradient(S * 0.5, 0, 0, S * 0.5, 0, S * 0.7);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(30,26,30,0.85)';
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(S * (0.1 + i * 0.06), S * (0.95 - i * 0.1), S * (0.8 - i * 0.1), S * 0.1);
    }
    ctx.fillStyle = '#1a1416';
    const fig = (x, y, h) => {
      ctx.beginPath();
      ctx.arc(x, y - h, h * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - h * 0.15, y - h * 0.82, h * 0.3, h * 0.82);
    };
    fig(S * 0.42, S * 0.36, S * 0.12);
    fig(S * 0.52, S * 0.46, S * 0.11);
    fig(S * 0.62, S * 0.56, S * 0.14);
    ctx.fillStyle = C.red;
    ctx.fillRect(S * 0.46, S * 0.38, S * 0.12, S * 0.012); // 汐娘的红腰带（《墨》里）
  },
];

function draw(ctx, i, S) {
  ctx.save();
  SCENES[i % SCENES.length](ctx, S);
  ctx.restore();
}

module.exports = { draw, PAGES, CAPTIONS, COUNT: SCENES.length, bird, gear, C };
