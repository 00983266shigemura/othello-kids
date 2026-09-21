/* Mac側の基準を測る台本（jsc で走らせる）
   使い方＝ /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc \
            /Users/shigemurasatoshi/dev/othello-kids/tools/bench_mac.js
   出す物＝①ルールの正しさの確認（手数の数え上げ）②1秒に読める局面数 ③5手先読みの最悪 ④終盤の完全読み */

load('/Users/shigemurasatoshi/dev/othello-kids/tools/core.js');

/* ---- ①ルールの正しさ＝初期局面からの手順の数え上げ（公表値と突き合わせる） ---- */
function perft(b, p, depth, passed) {
  if (depth === 0) { return 1; }
  var moves = OK.legalMoves(b, p), i, sq, flipped, sum = 0;
  if (moves.length === 0) {
    if (passed) { return 1; }
    return perft(b, OK.other(p), depth, true);
  }
  for (i = 0; i < moves.length; i++) {
    sq = moves[i];
    flipped = OK.applyMove(b, sq, p);
    sum += perft(b, OK.other(p), depth - 1, false);
    OK.undoMove(b, sq, p, flipped);
  }
  return sum;
}

var EXPECT = [4, 12, 56, 244, 1396, 8200, 55092, 390216];
var d, got, line = [];
for (d = 1; d <= 8; d++) {
  got = perft(OK.initBoard(), OK.BLACK, d, false);
  line.push('ふかさ' + d + '=' + got + (got === EXPECT[d - 1] ? ' 一致' : ' ちがう(期待' + EXPECT[d - 1] + ')'));
}
print('[1] ルールの確認 ' + line.join(' / '));

/* ---- ②1秒に読める局面数（3回測って中央値） ---- */
var i, r, msList = [], npsList = [];
for (i = 0; i < 3; i++) {
  r = OK.measureNps();
  msList.push(Math.round(r.ms * 100) / 100);
  npsList.push(r.nps);
}
npsList.sort(function (a, b) { return a - b; });
print('[2] 1秒に読める局面数 ' + npsList.join(' / ') + '（中央 ' + npsList[1] + '）'
  + '  深さ5の1手にかかった時間(ms) ' + msList.join(' / '));

/* ---- ③5手先読み・6手先読みの各局面と最悪値 ---- */
var depths = [5, 6], di, mid, worst, txt;
for (di = 0; di < depths.length; di++) {
  worst = 0; txt = [];
  for (i = 0; i < OK.midCases.length; i++) {
    mid = OK.measureMidOne(i, depths[di]);
    txt.push('石' + mid.discs + '=' + Math.round(mid.ms) + 'ms');
    if (mid.ms > worst) { worst = mid.ms; }
  }
  print('[3] ' + depths[di] + '手先読み ' + txt.join(' / ') + '  最悪 ' + Math.round(worst) + 'ms');
}

/* ---- ④終盤の完全読み ---- */
var e, end, out = [];
for (e = 8; e <= 14; e++) {
  end = OK.measureEndOne(e);
  out.push('あき' + e + '=' + Math.round(end.ms) + 'ms(' + end.nodes + '局面)');
}
print('[4] 終盤の完全読み ' + out.join(' / '));
