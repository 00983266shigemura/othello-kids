/* つよくなるオセロ ── 各段の「1手に読む局面の数」を測る（工程1・判定述語P5の前さばき）
   使い方＝ jsc time_check.js -- games=12
   なぜ局面の数か＝時間で測るとMacと2012年のiPadで別物になる。局面の数は端末に依らない。
   実機の時間は、工程0.5の実測（othello_kids_speed_20260921.html）の
     中盤＝1秒に20,276局面／終盤の完全読み＝あき11マス24,039局面を144ミリ秒
   から見積もる。終盤をあきらめて中盤の読みへ落ちた手は、両方の読みを足して数える。 */

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
var nGames = parseInt(A.games || '12', 10);

/* 実機の速さ（工程0.5の実測） */
var IPAD_MID_NPS = 20276;
var IPAD_END_NPS = 24039 / 0.144;   /* 1秒あたり約166,938局面 */

var lines = [];
var lv, g, cfg, rnd, b, p, passed, sq, legal;
var worstMid, worstEnd, worstMs, worstBoth, totalMoves, ms, c;

for (lv = 1; lv <= 20; lv++) {
  cfg = OKAI.cfgOf(lv);
  worstMid = 0; worstEnd = 0; worstMs = 0; worstBoth = 0; totalMoves = 0;
  for (g = 0; g < nGames; g++) {
    rnd = OKAI.makeRnd(555000 + lv * 1009 + g * 7919);
    b = OK.initBoard(); p = OK.BLACK; passed = false;
    while (true) {
      legal = OK.legalMoves(b, p);
      if (legal.length === 0) {
        if (passed) { break; }
        passed = true; p = OK.other(p); continue;
      }
      passed = false;
      /* 相手の番も同じ段にして、いろいろな局面を通す */
      sq = OKAI.chooseMove(b, p, cfg, rnd);
      c = OKAI.lastCost;
      totalMoves++;
      ms = c.end / IPAD_END_NPS * 1000 + c.mid / IPAD_MID_NPS * 1000;
      if (c.mid > worstMid) { worstMid = c.mid; }
      if (c.end > worstEnd) { worstEnd = c.end; }
      if (c.end > 0 && c.mid > 0 && (c.end + c.mid) > worstBoth) {
        worstBoth = c.end + c.mid;
      }
      if (ms > worstMs) { worstMs = ms; }
      OK.applyMove(b, sq, p);
      p = OK.other(p);
    }
  }
  lines.push('L' + lv
    + '\t' + JSON.stringify({ bad: cfg.bad, badDepth: cfg.badDepth,
        depth: cfg.depth, end: cfg.endEmpties, eps: cfg.eps })
    + '\t中盤の最悪=' + worstMid
    + '\t終盤の最悪=' + worstEnd
    + '\t終盤あきらめ＋中盤の最悪=' + worstBoth
    + '\t実機の見込み最悪=' + Math.round(worstMs) + 'ミリ秒'
    + '\t2秒以内=' + (worstMs <= 2000 ? 'はい' : 'いいえ')
    + '\t手数=' + totalMoves);
}
print('上限＝終盤 ' + OKAI.END_BUDGET + '局面（実機 約'
  + Math.round(OKAI.END_BUDGET / IPAD_END_NPS * 1000) + 'ミリ秒）／中盤 '
  + OKAI.MID_BUDGET + '局面（実機 約'
  + Math.round(OKAI.MID_BUDGET / IPAD_MID_NPS * 1000) + 'ミリ秒）'
  + '＝両方走っても 約'
  + Math.round(OKAI.END_BUDGET / IPAD_END_NPS * 1000
      + OKAI.MID_BUDGET / IPAD_MID_NPS * 1000) + 'ミリ秒');
print(lines.join('\n'));
