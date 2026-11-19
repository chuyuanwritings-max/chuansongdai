// 音效：全部用代码合成（不用音频文件），微信和浏览器都用 WebAudio 播放。
// make(name, sr) 返回一串 -1..1 的采样。以后换正式音效只要换这里。

function env(t, a, d) {
  return t < a ? t / a : Math.exp(-(t - a) / d);
}

function noise(seed) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
}

const sin = (f, t) => Math.sin(2 * Math.PI * f * t);
const sq = (f, t) => Math.sign(Math.sin(2 * Math.PI * f * t));

const RECIPES = {
  // 点连弩：蒸汽「嗤」+ 齿轮一咔
  launch: { len: 0.16, f: (t, n) => n() * env(t, 0.004, 0.04) * 0.35 + sq(220, t) * env(t, 0.001, 0.02) * 0.2 },
  // 点不了（传送带满了）：闷一声
  nope: { len: 0.14, f: (t) => sin(110, t) * env(t, 0.003, 0.05) * 0.5 },
  // 小连弩打空：噗 + 叮
  empty: { len: 0.3, f: (t, n) => n() * env(t, 0.005, 0.05) * 0.3 + sin(1568, t) * env(Math.max(0, t - 0.05), 0.002, 0.08) * (t > 0.05 ? 0.3 : 0) },
  // 回槽：铜匣咔哒
  slot: { len: 0.12, f: (t) => sq(330, t) * env(t, 0.001, 0.015) * 0.25 + sq(495, t) * env(Math.max(0, t - 0.04), 0.001, 0.015) * (t > 0.04 ? 0.2 : 0) },
  // 槽快满：低低两声
  warn: { len: 0.36, f: (t) => { const k = t < 0.18 ? t : t - 0.18; return sq(196, t) * env(k, 0.004, 0.05) * 0.22; } },
  // 三台合体：齿轮咬合 + 往上冲
  merge: { len: 0.55, f: (t, n) => sq(160, t) * env(t, 0.001, 0.03) * 0.25 + sin(300 + 900 * t, t) * env(Math.max(0, t - 0.06), 0.02, 0.25) * (t > 0.06 ? 0.4 : 0) + n() * env(t, 0.002, 0.04) * 0.15 },
  // 一种颜色清光：哗
  clear: { len: 0.6, f: (t, n) => n() * env(t, 0.02, 0.22) * 0.35 + sin(880 + 400 * t, t) * env(t, 0.01, 0.2) * 0.2 },
  // 赢：一串往上的和弦
  win: { len: 1.1, f: (t) => { const i = Math.min(4, Math.floor(t / 0.11)); const k = t - i * 0.11; return (sin([523, 659, 784, 1047, 1319][i], t) + 0.4 * sin([523, 659, 784, 1047, 1319][i] * 2, t)) * env(k, 0.005, i === 4 ? 0.4 : 0.12) * 0.3; } },
  // 插画刷开：亮亮的沙沙
  reveal: { len: 1.0, f: (t, n) => n() * env(t, 0.3, 0.3) * 0.12 + sin(2093, t) * env(t, 0.4, 0.3) * 0.08 },
  // 槽满了，输
  lose: { len: 0.8, f: (t) => sq(330 - 200 * t, t) * env(t, 0.01, 0.3) * 0.22 },
  // 金币
  coin: { len: 0.2, f: (t) => sq(t < 0.06 ? 1320 : 1760, t) * env(t < 0.06 ? t : t - 0.06, 0.002, 0.05) * 0.2 },
  // 机关伙伴出手
  pet: { len: 0.4, f: (t) => sin(784 + 300 * Math.sin(t * 30), t) * env(t, 0.01, 0.15) * 0.3 },
};

// 射中一格：短促的「哒」，连着射音调一级级往上（pop0 … pop11）
for (let i = 0; i < 12; i++) {
  const f = 520 * Math.pow(2, i / 12);
  RECIPES['pop' + i] = { len: 0.07, f: (t, n) => (sin(f, t) * 0.6 + n() * 0.25) * env(t, 0.001, 0.018) * 0.5 };
}

function make(name, sr) {
  const r = RECIPES[name];
  if (!r) return null;
  const n = Math.floor(r.len * sr);
  const out = new Float32Array(n);
  const rnd = noise(name.length * 7919 + 3);
  for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, r.f(i / sr, rnd)));
  return out;
}

module.exports = { make, NAMES: Object.keys(RECIPES) };
