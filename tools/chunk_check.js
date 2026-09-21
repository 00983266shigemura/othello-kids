/* つよくなるオセロ ── 「ひとかたまり」の大きさを測る（工程2・判定述語P9の後半）
   使い方＝ jsc chunk_check.js

   なにを見るか＝
     画面が固まるかどうかは「1手ぜんぶで何秒か」ではなく、
     「息をつぐまでの ひとかたまり が何秒か」で決まる。
     そこで、画面と同じ道すじ（makeChooser / makeJudger を step で回す）で
     1回の step が読む局面の数を数え、2012年のiPadの秒に直して いちばん大きいものを出す。

   秒への直しかた＝工程0.5の実機実測（othello_kids_speed_20260921.html）
     中盤の読み＝1秒に 20,276局面 ／ 終盤の完全読み＝1秒に 166,938局面
   ＝Macの時計ではなく 局面の数で見るので、この数字は端末に依らない。

   出すもの＝
     ①相手の1手の ひとかたまり の最悪（＝画面が止まる いちばん長い時間）
     ②相手の1手 ぜんぶ の最悪（判定述語P5＝2秒以内か）
     ③まけた わけの しらべ の ひとかたまり の最悪
     ④まけた わけの しらべ ぜんぶ の最悪（判定述語P9の前半＝5秒以内か）
*/

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');
/* 画面の台本も読み込む＝まとめて進める時間の上限を 画面と同じ値にするため。
   ui.js は OKUI.start() を呼ばれるまで DOM に触らないので、jsc でも読み込める。 */
load(HERE + 'ui.js');

var IPAD_MID_NPS = 20276;
var IPAD_END_NPS = 166938;
/* 画面のしらべは「決めた時間だけ まとめて進める」形なので、
   ひとかたまり＝その時間＋最後にはじめた1手ぶん（ui.js の pump と同じ値を使う） */
var JUDGE_BATCH_MS = OKUI.JUDGE_BATCH_MS;

/* 読んだ局面の合計を、途中で数え直されても 追えるようにする */
var carried = 0;
var origReset = OK.resetNodes;
OK.resetNodes = function () { carried += OK.getNodes(); origReset(); };
function monotonic() { return carried + OK.getNodes(); }

function msOf(nodes, phase) {
  return nodes / (phase === 'end' ? IPAD_END_NPS : IPAD_MID_NPS) * 1000;
}

var LEVELS = [1, 4, 8, 9, 12, 16, 20];
var GAMES = 4;

var worstChunk = { ms: 0, lv: 0, phase: '' };
var worstMove = { ms: 0, lv: 0, steps: 0 };
var worstJudgeChunk = { ms: 0, lv: 0 };
var worstJudgeTotal = { ms: 0, lv: 0, capped: false };
var rows = [], li, gi;

for (li = 0; li < LEVELS.length; li++) {
  var lv = LEVELS[li], cfg = OKAI.cfgOf(lv);
  var lvChunk = 0, lvMove = 0, lvJudgeChunk = 0, lvJudgeTotal = 0, cappedN = 0;

  for (gi = 0; gi < GAMES; gi++) {
    var seed = lv * 100003 + gi * 7919 + 1;
    var rnd = OKAI.makeRnd(seed);
    var b = OK.initBoard(), p = OK.BLACK, moves = [], passed = false;
    /* 子＝くろ（たくさん取る打ちかた）／ 相手＝しろ（その段） */
    var childColor = OK.BLACK, aiColor = OK.WHITE;

    while (true) {
      var legal = OK.legalMoves(b, p);
      if (legal.length === 0) {
        if (passed) { break; }
        passed = true;
        p = OK.other(p);
        continue;
      }
      passed = false;
      var sq;
      if (p === aiColor) {
        /* 画面と同じ道すじ＝ひとかたまり ずつ 読む */
        var ch = OKAI.makeChooser(b, p, cfg, rnd), done = false, moveMs = 0, nSteps = 0;
        while (!done) {
          var phase = ch.phase === 'end' ? 'end' : 'mid';
          var n0 = monotonic();
          done = ch.step();
          var chunkMs = msOf(monotonic() - n0, phase);
          moveMs += chunkMs;
          nSteps++;
          if (chunkMs > lvChunk) { lvChunk = chunkMs; }
          if (chunkMs > worstChunk.ms) {
            worstChunk = { ms: chunkMs, lv: lv, phase: phase };
          }
        }
        if (moveMs > lvMove) { lvMove = moveMs; }
        if (moveMs > worstMove.ms) { worstMove = { ms: moveMs, lv: lv, steps: nSteps }; }
        sq = ch.move;
      } else {
        sq = OKAI.PROXIES.greedy.fn(b, p, rnd);
      }
      if (sq < 0) { sq = legal[0]; }
      OK.applyMove(b, sq, p);
      moves.push({ sq: sq, player: p });
      p = OK.other(p);
    }

    /* まけた わけ の しらべ＝画面と同じく 60ミリ秒ぶん まとめて 進める形で測る */
    var jd = OKB.makeJudger(moves, childColor), jdone = false, totalMs = 0, batchMs = 0;
    while (!jdone) {
      var m0 = OKB.lastCost.mid, e0 = OKB.lastCost.end;
      jdone = jd.step();
      var stepMs = msOf(OKB.lastCost.mid - m0, 'mid') + msOf(OKB.lastCost.end - e0, 'end');
      totalMs += stepMs;
      batchMs += stepMs;
      if (batchMs >= JUDGE_BATCH_MS || jdone) {
        if (batchMs > lvJudgeChunk) { lvJudgeChunk = batchMs; }
        if (batchMs > worstJudgeChunk.ms) { worstJudgeChunk = { ms: batchMs, lv: lv }; }
        batchMs = 0;
      }
    }
    if (totalMs > lvJudgeTotal) { lvJudgeTotal = totalMs; }
    if (totalMs > worstJudgeTotal.ms) {
      worstJudgeTotal = { ms: totalMs, lv: lv, capped: OKB.lastCappedAt >= 0 };
    }
    if (OKB.lastCappedAt >= 0) { cappedN++; }
  }

  rows.push({
    lv: lv,
    chunkMs: Math.round(lvChunk),
    moveMs: Math.round(lvMove),
    judgeChunkMs: Math.round(lvJudgeChunk),
    judgeTotalMs: Math.round(lvJudgeTotal),
    capped: cappedN
  });
  print('れべる ' + lv
    + '  1かたまり最悪 ' + Math.round(lvChunk) + 'ms'
    + '  1手ぜんぶ最悪 ' + Math.round(lvMove) + 'ms'
    + '  しらべ1かたまり最悪 ' + Math.round(lvJudgeChunk) + 'ms'
    + '  しらべぜんぶ最悪 ' + Math.round(lvJudgeTotal) + 'ms'
    + '  上限に当たった局 ' + cappedN + '/' + GAMES);
}

print('');
print('=== 2012年のiPadに直した 最悪値（' + (LEVELS.length * GAMES) + '局・段' + LEVELS.join('/') + '） ===');
print('①相手の1手の ひとかたまり 最悪 = ' + Math.round(worstChunk.ms) + ' ミリ秒'
  + '（れべる' + worstChunk.lv + '・' + (worstChunk.phase === 'end' ? 'おわりの完全読み' : '中盤の読み') + '）');
print('②相手の1手 ぜんぶ 最悪 = ' + Math.round(worstMove.ms) + ' ミリ秒'
  + '（れべる' + worstMove.lv + '・' + worstMove.steps + 'かたまり）'
  + '  → P5（2秒以内）= ' + (worstMove.ms <= 2000 ? 'みたす' : 'やぶる'));
print('③しらべの ひとかたまり 最悪 = ' + Math.round(worstJudgeChunk.ms) + ' ミリ秒'
  + '（れべる' + worstJudgeChunk.lv + '）');
print('④しらべ ぜんぶ 最悪 = ' + Math.round(worstJudgeTotal.ms) + ' ミリ秒'
  + '（れべる' + worstJudgeTotal.lv + '）'
  + '  → P9前半（5秒以内）= ' + (worstJudgeTotal.ms <= 5000 ? 'みたす' : 'やぶる'));
print('');
print(JSON.stringify({ rows: rows }));
