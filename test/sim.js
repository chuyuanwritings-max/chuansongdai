// 无头平衡测试：每关用「会玩的机器人」和「像真人的机器人」各打很多局，
// 量三个数：一局平均几秒、赢的比例、输的局里「差一点」（剩 ≤25%）占多少；
// 再看「闭眼乱点」赢多少：和真人差得越多，说明选择越重要。
// 用法：node test/sim.js [每关几局]
const path = require('path');
const core = require(path.join(__dirname, '..', 'js', 'core.js'));
const { LEVELS, levelDef } = require(path.join(__dirname, '..', 'js', 'levels.js'));

const N = +process.argv[2] || 60;
const NEAR = +process.argv[3] || 0.25;
const rows = [];
const all = { time: 0, n: 0, lose: 0, near: 0 };
for (let li = 0; li < LEVELS.length; li++) {
  const def = levelDef(li);
  // 照真实进度带上机关伙伴：第 3 关过了有木犬，第 6 关过了有蒸汽龟（铜雀只加金币）
  const gameOpts = { dog: li >= 3, turtle: li >= 6 };
  const res = { good: 0, human: 0, rand: 0, t: 0, lose: 0, near: 0, leftPct: [] };
  for (let k = 0; k < N; k++) {
    const lvl = core.buildLevel(def, 1000 + li * 97 + k);
    const a = core.simulate(lvl, k + 1, { react: 0.25, gameOpts });
    if (a.win) res.good++;
    if (core.simulateRandom(lvl, k + 3, { gameOpts }).win) res.rand++;
    // 像真人：反应 0.6 秒左右，三成的时候没挑最好的那台（多半挑了一台打得到的，偶尔完全点错）
    const b = core.simulate(lvl, k + 7, { react: 0.6, noise: 0.3, gameOpts });
    res.t += b.time;
    if (b.win) res.human++;
    else {
      res.lose++;
      const p = b.left / b.total;
      res.leftPct.push(p);
      if (p <= NEAR) res.near++;
    }
  }
  all.time += res.t;
  all.n += N;
  all.lose += res.lose;
  all.near += res.near;
  const med = res.leftPct.sort((x, y) => x - y)[Math.floor(res.leftPct.length / 2)];
  rows.push(
    `${li + 1} ${def.name.padEnd(5, '　')} 会玩 ${Math.round((100 * res.good) / N)}%  真人 ${Math.round((100 * res.human) / N)}%  闭眼乱点 ${Math.round((100 * res.rand) / N)}%  一局 ${(res.t / N).toFixed(0)} 秒  输时剩中位 ${med === undefined ? '-' : Math.round(med * 100) + '%'}  差一点 ${res.lose ? Math.round((100 * res.near) / res.lose) : '-'}%`
  );
}
console.log(rows.join('\n'));
console.log(`\n总：一局平均 ${(all.time / all.n).toFixed(0)} 秒；输的局 ${all.lose} 局，其中差一点（剩 ≤${NEAR * 100}%）${all.lose ? Math.round((100 * all.near) / all.lose) : 0}%`);
