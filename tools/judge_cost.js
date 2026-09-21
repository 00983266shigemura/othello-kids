/* つよくなるオセロ ── 悪手判定器が1局ぶんで何秒かかるかを測る（工程1）
   使い方＝ jsc judge_cost.js -- games=8 depth=5 end=10
   なぜ要るか＝判定器は対局が終わってから走る。子どもを待たせられないので、
   実機（2012年iPad）で何秒かかるかを先に知っておく必要がある。
   中盤の読みと終盤の完全読みは1局面あたりの重さが違うので、分けて数えて換算する。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');

function parseArgs(argv) {
  var out = {}, i, kv;
  for (i = 0; i < argv.length; i++) {
    kv = String(argv[i]).split('=');
    out[kv[0]] = kv.length > 1 ? kv.slice(1).join('=') : '1';
  }
  return out;
}
var A = parseArgs(typeof arguments !== 'undefined' ? arguments : []);
var nGames = parseInt(A.games || '8', 10);
if (A.depth || A.end) {
  OKB.setJudgeSearch(A.depth ? parseInt(A.depth, 10) : undefined,
                     A.end ? parseInt(A.end, 10) : undefined);
}
/* cap=999999 で上限を実質なしにして「素の重さ」を測れる */
if (A.cap) { OKB.setJudgeCap(parseInt(A.cap, 10)); }

/* 工程0.5の実測 */
var IPAD_MID_NPS = 20276;
var IPAD_END_NPS = 24039 / 0.144;

var secs = [], capped = 0, g, childColor, r, c;

for (g = 0; g < nGames; g++) {
  childColor = (g % 2 === 0) ? OK.BLACK : OK.WHITE;
  var child = { type: 'proxy', key: (g % 2 === 0) ? 'greedy' : 'greedyCorner' };
  /* 強い段まで含める＝採点が重くなる局（長く もつれる局）を拾うため */
  var opp = { type: 'level', level: 9 + (g % 12) };
  r = OKAI.playGame(
    childColor === OK.BLACK ? child : opp,
    childColor === OK.BLACK ? opp : child,
    404000 + g * 7919, 4);
  OKB.judge(r.moves, childColor);
  if (OKB.lastCappedAt >= 0) { capped++; }
  c = OKB.lastCost;
  secs.push({
    mid: c.mid, end: c.end,
    sec: c.mid / IPAD_MID_NPS + c.end / IPAD_END_NPS
  });
}

secs.sort(function (a, b) { return a.sec - b.sec; });
function row(x) {
  return '中盤' + x.mid + '局面＋終盤' + x.end + '局面 → '
    + (Math.round(x.sec * 10) / 10) + '秒';
}
print('採点の読み＝' + JSON.stringify(OKB.getJudgeSearch())
  + ' ／ しきい値＝' + JSON.stringify(OKB.getThresholds()));
print('1局の採点にかかる実機の見込み（' + nGames + '局）');
print('  まん中 = ' + row(secs[Math.floor(secs.length / 2)]));
print('  上位10% = ' + row(secs[Math.floor(0.9 * (secs.length - 1))]));
print('  最悪   = ' + row(secs[secs.length - 1]));
print('  上限（' + OKB.JUDGE_MS_CAP + 'ミリ秒）に当たって途中でやめた局 = '
  + capped + ' / ' + nGames);
