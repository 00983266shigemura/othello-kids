/* つよくなるオセロ ── 悪手の しきい値 を決めるための実測（工程1）
   使い方＝ jsc scan_threshold.js -- games=40 child=Pgreedy level=10 seed=7
   出す物＝子の打った手の「損」の一覧（中盤・終盤べつ）をJSONで1行。
   これを python 側で percentile にかけて しきい値 を決める。 */

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
var games = parseInt(A.games || '40', 10);
var seed0 = parseInt(A.seed || '7', 10);
var level = parseInt(A.level || '10', 10);
var childKey = (A.child || 'Pgreedy').slice(1);

var JUDGE_DEPTH = parseInt(A.depth || '5', 10);
var JUDGE_END = parseInt(A.end || '12', 10);

var childSpec = { type: 'proxy', key: childKey };
var oppSpec = { type: 'level', level: level };

var midLoss = [], endLoss = [], perGame = [];
var g, childColor, r, b, p, mi, legal, sq, empties, best, played, loss;

for (g = 0; g < games; g++) {
  childColor = (g % 2 === 0) ? OK.BLACK : OK.WHITE;
  r = OKAI.playGame(
    childColor === OK.BLACK ? childSpec : oppSpec,
    childColor === OK.BLACK ? oppSpec : childSpec,
    seed0 * 1000003 + g * 7919 + 1, 4);

  var gMid = [], gEnd = [];
  b = OK.initBoard(); p = OK.BLACK; mi = 0;
  while (mi < r.moves.length) {
    legal = OK.legalMoves(b, p);
    if (legal.length === 0) { p = OK.other(p); continue; }
    sq = r.moves[mi].sq;
    if (p === childColor && legal.length >= 2) {
      empties = 64 - OK.discCount(b);
      if (empties <= JUDGE_END) {
        best = OK.bestMoveEnd(b, p).value;
        played = OK.valueOfMoveEnd(b, p, sq);
        loss = best - played;
        endLoss.push(loss); gEnd.push(loss);
      } else {
        best = OK.bestMoveMid(b, p, JUDGE_DEPTH).value;
        played = OK.valueOfMoveMid(b, p, sq, JUDGE_DEPTH);
        loss = best - played;
        midLoss.push(loss); gMid.push(loss);
      }
    }
    OK.applyMove(b, sq, p);
    p = OK.other(p); mi++;
  }
  perGame.push({
    lost: (r.winner !== 0 && r.winner !== childColor),
    draw: r.winner === 0,
    mid: gMid, end: gEnd
  });
}

print(JSON.stringify({
  child: A.child || 'Pgreedy', level: level, games: games,
  midLoss: midLoss, endLoss: endLoss, perGame: perGame
}));
