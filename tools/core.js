/* つよくなるオセロ ── はやさ はかり の中身（ES5のみ・DOMを使わない）
   2026-09-21 工程0.5。
   目的＝同じ計算を Mac と 2012年のiPad で走らせ、速さの倍率を実測で出す。
   約束事＝let/const/アロー/クラス/テンプレート文字列を使わない（Safari 10.1 で動く形）。
   盤は 0〜63 の配列。0=あき 1=くろ 2=しろ。 */

var OK = {};

(function () {
  'use strict';

  var EMPTY = 0, BLACK = 1, WHITE = 2;
  OK.EMPTY = EMPTY; OK.BLACK = BLACK; OK.WHITE = WHITE;

  /* ---- 8方向の光線を先に作る（当たり判定を毎回計算しない） ---- */
  var DR = [-1, -1, -1, 0, 0, 1, 1, 1];
  var DC = [-1, 0, 1, -1, 1, -1, 0, 1];
  var RAYS = [];   /* RAYS[sq] = [ 方向ごとのマス列 ] */
  (function buildRays() {
    var sq, d, r, c, ray;
    for (sq = 0; sq < 64; sq++) {
      RAYS[sq] = [];
      for (d = 0; d < 8; d++) {
        ray = [];
        r = (sq >> 3) + DR[d];
        c = (sq & 7) + DC[d];
        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          ray.push(r * 8 + c);
          r += DR[d];
          c += DC[d];
        }
        RAYS[sq].push(ray);
      }
    }
  })();

  /* ---- 盤の作りかた ---- */
  function initBoard() {
    var b = [], i;
    for (i = 0; i < 64; i++) { b.push(EMPTY); }
    b[27] = WHITE; b[28] = BLACK;
    b[35] = BLACK; b[36] = WHITE;
    return b;
  }
  OK.initBoard = initBoard;

  function other(p) { return p === BLACK ? WHITE : BLACK; }
  OK.other = other;

  /* 置けるなら裏返る枚数、置けないなら0 */
  function countFlips(b, sq, p) {
    if (b[sq] !== EMPTY) { return 0; }
    var opp = other(p), total = 0, d, ray, i, n, seen;
    for (d = 0; d < 8; d++) {
      ray = RAYS[sq][d];
      n = ray.length;
      seen = 0;
      for (i = 0; i < n; i++) {
        if (b[ray[i]] === opp) { seen++; continue; }
        if (b[ray[i]] === p && seen > 0) { total += seen; }
        break;
      }
    }
    return total;
  }
  OK.countFlips = countFlips;

  /* 置いて裏返す。戻り値＝裏返したマスの配列（戻すときに使う） */
  function applyMove(b, sq, p) {
    var opp = other(p), flipped = [], d, ray, i, n, run, j;
    for (d = 0; d < 8; d++) {
      ray = RAYS[sq][d];
      n = ray.length;
      run = 0;
      for (i = 0; i < n; i++) {
        if (b[ray[i]] === opp) { run++; continue; }
        if (b[ray[i]] === p && run > 0) {
          for (j = 0; j < run; j++) { flipped.push(ray[j]); }
        }
        break;
      }
    }
    for (i = 0; i < flipped.length; i++) { b[flipped[i]] = p; }
    b[sq] = p;
    return flipped;
  }
  OK.applyMove = applyMove;

  function undoMove(b, sq, p, flipped) {
    var opp = other(p), i;
    for (i = 0; i < flipped.length; i++) { b[flipped[i]] = opp; }
    b[sq] = EMPTY;
  }
  OK.undoMove = undoMove;

  /* 置ける場所の一覧。角・辺を先に見る並び（読みを早く切るため・端末に依らない固定順） */
  var ORDER = [
    0, 7, 56, 63,
    2, 3, 4, 5, 16, 24, 32, 40, 23, 31, 39, 47, 58, 59, 60, 61,
    18, 19, 20, 21, 26, 27, 28, 29, 34, 35, 36, 37, 42, 43, 44, 45,
    10, 11, 12, 13, 17, 22, 25, 30, 33, 38, 41, 46, 50, 51, 52, 53,
    1, 6, 8, 15, 48, 55, 57, 62,
    9, 14, 49, 54
  ];
  function legalMoves(b, p) {
    var out = [], i, sq;
    for (i = 0; i < 64; i++) {
      sq = ORDER[i];
      if (countFlips(b, sq, p) > 0) { out.push(sq); }
    }
    return out;
  }
  OK.legalMoves = legalMoves;

  function discDiff(b, p) {
    var mine = 0, theirs = 0, i;
    for (i = 0; i < 64; i++) {
      if (b[i] === p) { mine++; }
      else if (b[i] !== EMPTY) { theirs++; }
    }
    return mine - theirs;
  }
  OK.discDiff = discDiff;

  function discCount(b) {
    var n = 0, i;
    for (i = 0; i < 64; i++) { if (b[i] !== EMPTY) { n++; } }
    return n;
  }
  OK.discCount = discCount;

  /* ---- 手の良さの見積り（中盤）＝マスの重み＋置ける手数 ---- */
  var W = [
    120, -20, 20, 5, 5, 20, -20, 120,
    -20, -40, -5, -5, -5, -5, -40, -20,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -20, -40, -5, -5, -5, -5, -40, -20,
    120, -20, 20, 5, 5, 20, -20, 120
  ];

  var nodes = 0;
  OK.getNodes = function () { return nodes; };
  OK.resetNodes = function () { nodes = 0; };

  /* 読みの打ち切り（節点予算）＝読んだ局面の数が上限を超えたら、そこで読むのをやめる。
     上限は「局面の数」で書く＝時間ではないので、Macでも2012年のiPadでも同じ所で止まる。
     既定は -1（＝上限なし）＝工程0.5で測ったときと同じ動き。 */
  var budget = -1;
  var BUDGET_STOP = { stop: 'budget' };
  OK.BUDGET_STOP = BUDGET_STOP;
  OK.setBudget = function (n) { budget = (typeof n === 'number' && n > 0) ? n : -1; };
  OK.clearBudget = function () { budget = -1; };

  function evalBoard(b, p) {
    var opp = other(p), s = 0, i;
    for (i = 0; i < 64; i++) {
      if (b[i] === p) { s += W[i]; }
      else if (b[i] === opp) { s -= W[i]; }
    }
    return s + 3 * (legalMoves(b, p).length - legalMoves(b, opp).length);
  }
  OK.evalBoard = evalBoard;

  /* ---- 中盤の先読み（深さ指定・アルファベータ） ---- */
  function searchMid(b, p, depth, alpha, beta, passed) {
    nodes++;
    if (budget > 0 && nodes > budget) { throw BUDGET_STOP; }
    if (depth === 0) { return evalBoard(b, p); }
    var moves = legalMoves(b, p), i, sq, flipped, v;
    if (moves.length === 0) {
      if (passed) { return 1000 * discDiff(b, p); }
      return -searchMid(b, other(p), depth, -beta, -alpha, true);
    }
    for (i = 0; i < moves.length; i++) {
      sq = moves[i];
      flipped = applyMove(b, sq, p);
      v = -searchMid(b, other(p), depth - 1, -beta, -alpha, false);
      undoMove(b, sq, p, flipped);
      if (v > alpha) { alpha = v; }
      if (alpha >= beta) { return alpha; }
    }
    return alpha;
  }

  /* 最善手と値を返す（実際の対局で使う形＝この時間を測る） */
  OK.bestMoveMid = function (b, p, depth) {
    var moves = legalMoves(b, p), best = -1, bestV = -1e9, i, sq, flipped, v;
    for (i = 0; i < moves.length; i++) {
      sq = moves[i];
      flipped = applyMove(b, sq, p);
      v = -searchMid(b, other(p), depth - 1, -1e9, -bestV, false);
      undoMove(b, sq, p, flipped);
      if (v > bestV) { bestV = v; best = sq; }
    }
    return { move: best, value: bestV };
  };

  /* ---- 終盤の完全読み（最後まで読む・石差そのもの） ---- */
  function searchEnd(b, p, alpha, beta, passed) {
    nodes++;
    if (budget > 0 && nodes > budget) { throw BUDGET_STOP; }
    var moves = legalMoves(b, p), i, sq, flipped, v;
    if (moves.length === 0) {
      if (passed) { return discDiff(b, p); }
      return -searchEnd(b, other(p), -beta, -alpha, true);
    }
    for (i = 0; i < moves.length; i++) {
      sq = moves[i];
      flipped = applyMove(b, sq, p);
      v = -searchEnd(b, other(p), -beta, -alpha, false);
      undoMove(b, sq, p, flipped);
      if (v > alpha) { alpha = v; }
      if (alpha >= beta) { return alpha; }
    }
    return alpha;
  }
  OK.solveEnd = function (b, p) {
    return searchEnd(b, p, -64, 64, false);
  };

  /* 終盤の完全読みで「どこに置くか」まで返す（対局で使う形） */
  OK.bestMoveEnd = function (b, p) {
    var moves = legalMoves(b, p), best = -1, bestV = -65, i, sq, flipped, v;
    for (i = 0; i < moves.length; i++) {
      sq = moves[i];
      flipped = applyMove(b, sq, p);
      v = -searchEnd(b, other(p), -64, -bestV, false);
      undoMove(b, sq, p, flipped);
      if (v > bestV) { bestV = v; best = sq; }
    }
    return { move: best, value: bestV };
  };

  /* 盤の写し（読みを途中でやめたときに元へ戻すために使う） */
  OK.copyBoard = function (b) {
    var out = [], i;
    for (i = 0; i < 64; i++) { out.push(b[i]); }
    return out;
  };

  /* 打った1手の「よさ」を返す（悪手の判定に使う＝最善手との差を取るため）。
     窓を広くとるので最善手さがしより遅い＝対局中には呼ばず、対局が終わってから呼ぶ。 */
  OK.valueOfMoveMid = function (b, p, sq, depth) {
    var flipped = applyMove(b, sq, p);
    var v = -searchMid(b, other(p), depth - 1, -1e9, 1e9, false);
    undoMove(b, sq, p, flipped);
    return v;
  };

  /* 「打った手の値が bound 以下か」だけを、窓を1目もりに絞って安く調べる。
     悪手かどうかの ふるい に使う＝ほとんどの手はここで落ちるので、
     値そのものを出す重い読み（valueOfMoveMid）は残った手にだけ使えばよい。 */
  OK.moveValueAtMostMid = function (b, p, sq, depth, bound) {
    var flipped = applyMove(b, sq, p);
    var r = searchMid(b, other(p), depth - 1, -(bound + 1), -bound, false);
    undoMove(b, sq, p, flipped);
    return -r <= bound;
  };

  /* 終盤版の ふるい＝窓を1石ぶんに絞って「bound 以下か」だけを安く調べる */
  OK.moveValueAtMostEnd = function (b, p, sq, bound) {
    var flipped = applyMove(b, sq, p);
    var r = searchEnd(b, other(p), -(bound + 1), -bound, false);
    undoMove(b, sq, p, flipped);
    return -r <= bound;
  };

  OK.valueOfMoveEnd = function (b, p, sq) {
    var flipped = applyMove(b, sq, p);
    var v = -searchEnd(b, other(p), -64, 64, false);
    undoMove(b, sq, p, flipped);
    return v;
  };

  /* ---- 決まった局面を作る（同じ種＝MacでもiPadでも同じ盤になる） ---- */
  function minstd(seed) {
    var s = seed;
    return function () {
      s = (s * 16807) % 2147483647;   /* 2^53 を超えないので端末に依らず同じ値 */
      return s / 2147483647;
    };
  }

  /* 石が targetDiscs 枚になるまで、決まった乱数で打ち進めた局面を返す */
  OK.makePos = function (targetDiscs, seed) {
    var b = initBoard(), p = BLACK, rnd = minstd(seed || 12345);
    var passed = false, moves, sq;
    while (discCount(b) < targetDiscs) {
      moves = legalMoves(b, p);
      if (moves.length === 0) {
        if (passed) { break; }
        passed = true;
        p = other(p);
        continue;
      }
      passed = false;
      sq = moves[Math.floor(rnd() * moves.length)];
      applyMove(b, sq, p);
      p = other(p);
    }
    return { board: b, player: p, discs: discCount(b) };
  };

  OK.now = function () {
    if (typeof performance !== 'undefined' && performance && performance.now) {
      return performance.now();
    }
    return Date.now();
  };

  /* ================= はかる中身 ================= */

  /* ①1秒に読める局面の数＝深さ5の先読みを1回して、局面数÷秒 */
  OK.measureNps = function () {
    var pos = OK.makePos(20), t0, t1;
    OK.resetNodes();
    t0 = OK.now();
    OK.bestMoveMid(pos.board, pos.player, 5);
    t1 = OK.now();
    var ms = t1 - t0;
    return { ms: ms, nodes: OK.getNodes(), nps: Math.round(OK.getNodes() / (ms / 1000)) };
  };

  /* ②5手先読みが いちばん遅いとき（石数のちがう6局面の最悪値） */
  var MID_DISCS = [12, 20, 28, 36, 44, 52];
  OK.midCases = MID_DISCS;
  OK.measureMidOne = function (i, depth) {
    var pos = OK.makePos(MID_DISCS[i]), t0, t1, n0;
    n0 = OK.getNodes();
    t0 = OK.now();
    OK.bestMoveMid(pos.board, pos.player, depth);
    t1 = OK.now();
    return { discs: MID_DISCS[i], ms: t1 - t0, nodes: OK.getNodes() - n0 };
  };

  /* ③終盤の完全読み（あき N マス） */
  OK.measureEndOne = function (empties) {
    var pos = OK.makePos(64 - empties), t0, t1, n0, v;
    n0 = OK.getNodes();
    t0 = OK.now();
    v = OK.solveEnd(pos.board, pos.player);
    t1 = OK.now();
    return { empties: empties, ms: t1 - t0, nodes: OK.getNodes() - n0, value: v };
  };

  /* 別スレッド（Web Worker）が使えるかだけ見る＝設計の予備案の確認 */
  OK.workerOk = function () {
    try {
      if (typeof Worker === 'undefined') { return 'つかえない（Worker なし）'; }
      if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
        return 'あやしい（Blob URL がない）';
      }
      return 'つかえそう（Worker＋Blob URL あり）';
    } catch (e) {
      return 'しらべられなかった';
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = OK; }
