/* つよくなるオセロ ── 自己対戦の台本（jsc で走らせる）
   2026-09-21 工程1。
   使い方＝
     jsc selfplay.js -- a=L12 b=L13 games=200 seed=1 opening=4
   あいての書き方＝ L1〜L20（梯子の段） / Pgreedy（たくさん取る子） / PgreedyCorner（＋かど）
   出す物＝1行の結果（a から見た勝ち・負け・引き分け）。
   色は1局ごとに入れかえる＝偶数番は a がくろ、奇数番は a がしろ。 */

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

function parseSpec(s) {
  if (s.charAt(0) === 'L') { return { type: 'level', level: parseInt(s.slice(1), 10), label: s }; }
  if (s.charAt(0) === 'P') { return { type: 'proxy', key: s.slice(1), label: s }; }
  /* C:depth=6,end=12,eps=0.3,bad=0,corner=0 ＝ 梯子に無い設定をその場で作って測る */
  if (s.slice(0, 2) === 'C:') {
    var cfg = { kind: 'search', label: s }, parts = s.slice(2).split(','), i, kv;
    for (i = 0; i < parts.length; i++) {
      kv = parts[i].split('=');
      if (kv[0] === 'depth') { cfg.depth = parseInt(kv[1], 10); }
      else if (kv[0] === 'end') { cfg.endEmpties = parseInt(kv[1], 10); }
      else if (kv[0] === 'eps') { cfg.eps = parseFloat(kv[1]); }
      else if (kv[0] === 'bad') { cfg.bad = parseFloat(kv[1]); cfg.kind = 'random'; }
      else if (kv[0] === 'badDepth') { cfg.badDepth = parseInt(kv[1], 10); }
      else if (kv[0] === 'corner') { cfg.cornerP = parseFloat(kv[1]); cfg.kind = 'random'; }
      else if (kv[0] === 'rand') { cfg.kind = 'random'; }
      else { throw new Error('しらない設定: ' + parts[i]); }
    }
    return { type: 'cfg', cfg: cfg, label: s };
  }
  throw new Error('あいての書き方がちがう: ' + s);
}

var A = parseArgs(typeof arguments !== 'undefined' ? arguments : []);
var specA = parseSpec(A.a);
var specB = parseSpec(A.b);
var games = parseInt(A.games || '200', 10);
var seed0 = parseInt(A.seed || '1', 10);
var opening = parseInt(A.opening === undefined ? '4' : A.opening, 10);

var aWin = 0, bWin = 0, draw = 0;
var aBlackWin = 0, aBlackN = 0, aWhiteWin = 0, aWhiteN = 0;
var t0 = OK.now(), i, black, white, r, aIsBlack, seed;

for (i = 0; i < games; i++) {
  aIsBlack = (i % 2 === 0);
  black = aIsBlack ? specA : specB;
  white = aIsBlack ? specB : specA;
  /* 種＝対戦ごと・局ごとに変える。同じ引数なら何度走らせても同じ結果になる */
  seed = seed0 * 1000003 + i * 7919 + 1;
  r = OKAI.playGame(black, white, seed, opening);
  if (r.winner === 0) { draw++; }
  else if ((r.winner === OK.BLACK) === aIsBlack) {
    aWin++;
    if (aIsBlack) { aBlackWin++; } else { aWhiteWin++; }
  } else { bWin++; }
  if (aIsBlack) { aBlackN++; } else { aWhiteN++; }
}
var t1 = OK.now();

/* 勝率＝引き分けを0.5勝として数える（段の上下を見るため） */
var score = (aWin + 0.5 * draw) / games;
print(JSON.stringify({
  a: specA.label, b: specB.label, games: games, opening: opening, seed: seed0,
  aWin: aWin, bWin: bWin, draw: draw,
  aScore: Math.round(score * 10000) / 10000,
  aAsBlack: { n: aBlackN, win: aBlackWin },
  aAsWhite: { n: aWhiteN, win: aWhiteWin },
  ms: Math.round(t1 - t0)
}));
