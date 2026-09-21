/* つよくなるオセロ ── 悪手判定器の「自分の誤差」を測る（工程1）
   使い方＝ jsc judge_noise.js -- games=16 depth=4 end=10
   考え方＝じょうずな打ちて（ふかさ6・あき12から完全読み）の手を、
   採点用の浅い読みで採点する。出てきた「損」は、ほぼ判定器自身の見立て違いである。
   しきい値はこの誤差より大きく取らないと、悪くない手を悪手と呼んでしまう。 */

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
var nGames = parseInt(A.games || '16', 10);
var D = parseInt(A.depth || '4', 10);
var E = parseInt(A.end || '10', 10);

var strong = { kind: 'search', depth: 6, endEmpties: 12, eps: 0 };
var midLoss = [], endLoss = [], g, color, r, b, p, mi, legal, sq, empties, best, played;

for (g = 0; g < nGames; g++) {
  color = (g % 2 === 0) ? OK.BLACK : OK.WHITE;
  var opp = { type: 'level', level: 9 + (g % 12) };
  r = OKAI.playGame(
    color === OK.BLACK ? { type: 'cfg', cfg: strong } : opp,
    color === OK.BLACK ? opp : { type: 'cfg', cfg: strong },
    777000 + g * 7919, 4);

  /* ここから採点＝判定器と同じ見方にそろえる（対局中は もとの見方のまま） */
  OK.setMidTerminalAsEval(true);
  b = OK.initBoard(); p = OK.BLACK; mi = 0;
  while (mi < r.moves.length) {
    legal = OK.legalMoves(b, p);
    if (legal.length === 0) { p = OK.other(p); continue; }
    sq = r.moves[mi].sq;
    if (p === color && legal.length >= 2) {
      empties = 64 - OK.discCount(b);
      if (empties <= E) {
        best = OK.bestMoveEnd(b, p).value;
        played = OK.valueOfMoveEnd(b, p, sq);
        endLoss.push(best - played);
      } else {
        best = OK.bestMoveMid(b, p, D).value;
        played = OK.valueOfMoveMid(b, p, sq, D);
        midLoss.push(best - played);
      }
    }
    OK.applyMove(b, sq, p);
    p = OK.other(p); mi++;
  }
  OK.setMidTerminalAsEval(false);
}

function show(name, xs) {
  if (!xs.length) { print(name + ' ＝ なし'); return; }
  xs.sort(function (a, b) { return a - b; });
  function q(f) { return xs[Math.min(xs.length - 1, Math.floor(f * (xs.length - 1)))]; }
  print(name + ' 手数=' + xs.length
    + ' ／ まん中=' + q(0.5) + ' ／ p90=' + q(0.9) + ' ／ p95=' + q(0.95)
    + ' ／ p99=' + q(0.99) + ' ／ 最悪=' + xs[xs.length - 1]);
}

print('採点の読み＝ふかさ' + D + '・あき' + E + 'マスから完全読み');
show('じょうずな打ちての手に出た「損」（中盤）', midLoss);
show('じょうずな打ちての手に出た「損」（終盤・石）', endLoss);
