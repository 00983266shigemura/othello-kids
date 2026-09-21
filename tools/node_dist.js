/* つよくなるオセロ ── 実戦で出る局面の「読む局面の数」の分布を測る（工程1）
   使い方＝ jsc node_dist.js -- games=30
   なぜ要るか＝工程0.5の速さ実測は、中盤6局面・終盤は深さごとに1局面だけを測っていた。
   実戦ではもっと重い局面が出る。上限（P5＝実機2秒）を決めるには、分布の裾を見る必要がある。
   時間ではなく局面の数で出す＝端末に依らない。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');

function parseArgs(argv) {
  var out = {}, i, kv;
  for (i = 0; i < argv.length; i++) {
    kv = String(argv[i]).split('=');
    out[kv[0]] = kv.length > 1 ? kv.slice(1).join('=') : '1';
  }
  return out;
}
var A = parseArgs(typeof arguments !== 'undefined' ? arguments : []);
var nGames = parseInt(A.games || '30', 10);

/* いろいろな棋力の相手どうしで対局し、通った局面をすべて集める */
var OPPS = [
  { kind: 'search', depth: 6, endEmpties: 12, eps: 0 },
  { kind: 'search', depth: 6, endEmpties: 12, eps: 0.48 },
  { kind: 'random', bad: 0 }
];

var midNodes = [];            /* ふかさ6の中盤の読み */
var endNodes = { 8: [], 9: [], 10: [], 11: [], 12: [] };  /* 完全読み・あきマス別 */

var g, oi, b, p, passed, legal, sq, empties, n0, rnd, cfg;

for (g = 0; g < nGames; g++) {
  for (oi = 0; oi < OPPS.length; oi++) {
    cfg = OPPS[oi];
    rnd = OKAI.makeRnd(909000 + g * 7919 + oi * 131);
    b = OK.initBoard(); p = OK.BLACK; passed = false;
    while (true) {
      legal = OK.legalMoves(b, p);
      if (legal.length === 0) {
        if (passed) { break; }
        passed = true; p = OK.other(p); continue;
      }
      passed = false;
      empties = 64 - OK.discCount(b);

      if (legal.length >= 2) {
        if (empties >= 13) {
          /* 中盤＝ふかさ6の最善手さがしに何局面かかるか */
          OK.resetNodes();
          OK.bestMoveMid(b, p, 6);
          midNodes.push(OK.getNodes());
        } else if (empties >= 8) {
          /* 終盤＝あきマスちょうどの完全読みに何局面かかるか */
          OK.resetNodes();
          OK.bestMoveEnd(b, p);
          endNodes[empties].push(OK.getNodes());
        }
      }
      sq = OKAI.chooseMove(b, p, cfg, rnd);
      if (sq < 0) { sq = legal[0]; }
      OK.applyMove(b, sq, p);
      p = OK.other(p);
    }
  }
}

function stat(name, xs, nps) {
  if (xs.length === 0) { print(name + ' ＝ 測れた局面なし'); return; }
  xs.sort(function (a, b) { return a - b; });
  function q(f) { return xs[Math.min(xs.length - 1, Math.floor(f * (xs.length - 1)))]; }
  function ms(v) { return Math.round(v / nps * 1000); }
  print(name + ' 局面数=' + xs.length
    + ' ／ 中央=' + q(0.5) + '(' + ms(q(0.5)) + 'ミリ秒)'
    + ' ／ p90=' + q(0.9) + '(' + ms(q(0.9)) + ')'
    + ' ／ p99=' + q(0.99) + '(' + ms(q(0.99)) + ')'
    + ' ／ 最悪=' + xs[xs.length - 1] + '(' + ms(xs[xs.length - 1]) + ')');
}

var IPAD_MID_NPS = 20276;
var IPAD_END_NPS = 24039 / 0.144;

print('（かっこ内＝2012年iPadでの見込み時間。中盤は1秒20,276局面・終盤は1秒166,938局面で換算）');
stat('ふかさ6の中盤', midNodes, IPAD_MID_NPS);
var e;
for (e = 8; e <= 12; e++) {
  stat('完全読み あき' + e + 'マス', endNodes[e], IPAD_END_NPS);
}
