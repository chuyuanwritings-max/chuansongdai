// 测试机器人：在手机大小的浏览器里把整套流程点一遍，并量三个数。用法：node test/robot.js [快进连打几局]
const { chromium } = require('/Users/chuyuannc/Downloads/Cursor/Kira/06_游戏设计/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const shots = path.join(__dirname, 'shots');
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'preview.html'));
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  const ok = [];
  const check = (cond, msg) => { if (!cond) throw new Error('没通过：' + msg); ok.push(msg); console.log('✓ ' + msg); };
  const g = (fn, arg) => page.evaluate(fn, arg);
  const snap = (n) => page.screenshot({ path: path.join(shots, n + '.png') });
  const status = () => g(() => __cjg.S.g.status);
  const btn = (id) => g((i) => __cjg.S.buttons.find((b) => b.id === i) || null, id);
  const clickBtn = async (id) => {
    const b = await btn(id);
    if (!b) throw new Error('找不到按钮 ' + id);
    await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2);
    await page.waitForTimeout(60);
  };
  // 真的用鼠标点：点下面第 i 列 / 第 i 个槽
  const tapCol = async (i) => {
    const p = await g((k) => ({ x: __cjg.colX(k, __cjg.S.g.cols.length), y: __cjg.colItemY(0) }), i);
    await page.mouse.click(p.x, p.y);
  };
  const tapSlot = async (i) => {
    const p = await g((k) => __cjg.slotPos(k, __cjg.S.g.slots.length), i);
    await page.mouse.click(p.x, p.y);
  };
  // 机器人挑一步，用鼠标点出去
  const botStep = async (noise) => {
    const pk = await g((nz) => {
      const V = __cjg; const gg = V.S.g;
      if (gg.status !== 'play') return null;
      const p = V.core.botPick(gg, Math.random, nz);
      return p ? { kind: p.kind, i: p.i } : null;
    }, noise || 0);
    if (!pk) return false;
    if (pk.kind === 'col') await tapCol(pk.i); else await tapSlot(pk.i);
    return true;
  };

  // 故意点最没用的那台（让它输）
  const tapWorst = () => g(() => {
    const V = __cjg; const gg = V.S.g; const sc = new Int8Array(gg.cells.length);
    let worst = -1, wv = 1e9;
    gg.cols.forEach((c, i) => { if (c.length) { const v = V.core.estimate(gg, c[0], sc); if (v < wv) { wv = v; worst = i; } } });
    if (worst >= 0) V.core.tapColumn(gg, worst); else { const j = gg.slots.findIndex((x) => x); if (j >= 0) V.core.tapSlot(gg, j); }
  });

  // —— 1 开局 ——
  check((await g(() => __cjg.S.levelNo)) === 0, '一打开就是第 1 关，不用点开始');
  check((await g(() => __cjg.save.hinted)) === false, '第一次玩有手势提示');
  await snap('01_开局');
  const before = await g(() => __cjg.S.g.cols[0].length);
  await tapCol(0);
  await page.waitForTimeout(100);
  check((await g(() => __cjg.S.g.cols[0].length)) === before - 1, '点第一列，最前面那台上了传送带');
  check((await g(() => __cjg.save.hinted)) === true, '点过一次手势就不再出现');
  await page.waitForTimeout(1200);
  check((await g(() => __cjg.S.g.left < __cjg.S.g.total)), '连弩自己射掉了同色像素');
  const t10 = await g(() => __cjg.S.time);
  check(t10 < 10, '第一下爽反馈在 10 秒内（' + t10.toFixed(1) + ' 秒）');
  await snap('02_射击中');

  // —— 2 打赢第一关 ——
  for (let k = 0; k < 400 && (await status()) === 'play'; k++) { await botStep(0); await page.waitForTimeout(150); }
  check((await status()) === 'win', '第 1 关打赢了');
  await page.waitForTimeout(600);
  await snap('03_插画刷开');
  await page.waitForTimeout(1000);
  await snap('04_过关页');
  check(!!(await btn('next')), '过关页有「下一关」');
  check((await g(() => __cjg.save.album[0])) === true, '画册第 1 格解锁');
  check((await g(() => __cjg.save.pets.que)) === true, '第 1 关掉了机关伙伴「铜雀」');
  check((await g(() => __cjg.save.coins)) > 0, '赢了给金币');
  await clickBtn('adCoins');
  await page.waitForTimeout(400);
  await snap('05_广告占位');
  await page.waitForTimeout(3000);
  check((await g(() => __cjg.S.reward.doubled)) === true, '看广告金币翻倍');
  await clickBtn('next');
  check((await g(() => __cjg.S.levelNo)) === 1 && (await status()) === 'play', '一点「下一关」直接开第 2 关');

  // —— 3 故意输：一直点不对的那台 ——
  for (let k = 0; k < 300 && (await status()) === 'play'; k++) {
    await tapWorst();
    await page.waitForTimeout(120);
  }
  check((await status()) === 'full', '乱点会把槽塞满、输掉');
  const failAt = Date.now();
  let retryBtn = null;
  while (!(retryBtn = await btn('retry'))) await page.waitForTimeout(20);
  const panelMs = Date.now() - failAt;
  await page.waitForTimeout(350);
  await snap('06_失败页');
  check(!!(await btn('adSlot')), '失败页有「机关匣加一格」广告按钮');
  // 看广告续命
  const nSlots = await g(() => __cjg.S.g.slots.length);
  await clickBtn('adSlot');
  await page.waitForTimeout(3200);
  check((await status()) === 'play' && (await g(() => __cjg.S.g.slots.length)) === nSlots + 1, '看完广告多一格槽，接着打');
  // 再输一次，量死到再开局
  // 去第 8 关故意输（赢了就重开再来），量死到再开局
  for (let tries = 0; tries < 6 && (await status()) !== 'full'; tries++) {
    await g(() => { const V = __cjg; V.save.level = 7; V.startLevel(); });
    for (let k = 0; k < 400 && (await status()) === 'play'; k++) { await tapWorst(); await page.waitForTimeout(80); }
  }
  check((await status()) === 'full', '第 8 关乱点会输');
  const t0 = Date.now();
  while (!(await btn('retry')) || (await g(() => __cjg.S.endT)) < 0.86) await page.waitForTimeout(20);
  await clickBtn('retry');
  const restartMs = Date.now() - t0;
  check((await status()) === 'play', '失败页一点「再来」就开新的一局');
  check(restartMs < 3000, '死到再开局 ' + (restartMs / 1000).toFixed(2) + ' 秒（机器人一看到按钮就点；真人再加反应时间）');

  // —— 4 画册 ——
  await clickBtn('album');
  await page.waitForTimeout(200);
  await snap('07_画册');
  check((await g(() => __cjg.S.album.open)) === true, '画册能打开');
  await clickBtn('closeAlbum');

  // —— 5 快进连打：像真人的机器人，量三个数 ——
  const N = +process.argv[2] || 24;
  await g(() => { __cjg.S.timeScale = 4; __cjg.S.stats.rounds = []; __cjg.S.stats.restarts = []; });
  let played = 0;
  let level = 1;
  while (played < N) {
    await g((lv) => { const V = __cjg; V.save.level = lv; V.save.buy = false; V.startLevel(); }, level);
    for (let k = 0; k < 2000 && (await status()) === 'play'; k++) {
      await botStep(0.3);
      await page.waitForTimeout(Math.round((600 * (0.6 + Math.random() * 0.8)) / 4));
    }
    played++;
    level = 1 + (played % 7); // 第 2–8 关轮着打
  }
  const stats = await g(() => __cjg.S.stats.rounds);
  const avg = stats.reduce((a, r) => a + r.time, 0) / stats.length;
  const losses = stats.filter((r) => !r.win);
  const near25 = losses.filter((r) => r.left <= 0.25).length;
  const near15 = losses.filter((r) => r.left <= 0.15).length;
  console.log(`\n快进连打 ${stats.length} 局（第 2–8 关，像真人的机器人）：赢 ${stats.length - losses.length} 局`);
  console.log(`一局平均 ${avg.toFixed(0)} 秒（游戏内时间）`);
  console.log(`输 ${losses.length} 局：剩 ≤25% 的 ${near25} 局（${losses.length ? Math.round((100 * near25) / losses.length) : 0}%），剩 ≤15% 的 ${near15} 局`);
  console.log(`失败页 ${panelMs} 毫秒弹出；死到再开局 ${(restartMs / 1000).toFixed(2)} 秒`);
  check(errors.length === 0, '全程没有报错' + (errors.length ? '：' + errors.join(' | ') : ''));
  fs.writeFileSync(path.join(__dirname, 'robot_result.json'), JSON.stringify({ rounds: stats, panelMs, restartMs, checks: ok }, null, 1));
  console.log(`\n${ok.length} 项通过`);
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
