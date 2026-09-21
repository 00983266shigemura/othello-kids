/* つよくなるオセロ ── 相手の打ちかた（20段の梯子）
   2026-09-21 工程1。ES5のみ・DOMを使わない。core.js を先に load すること。

   段の決め方は「端末に依らない形」だけで書く＝
     よみのふかさ（depth）／おわりの完全読みを始めるあきマス数（endEmpties）／
     わざと下手を打つ確率（eps）／わざと一番わるい手を打つ確率（bad）／
     かどを取る確率（cornerP）／読む局面の数の上限（budget）。
   時間では書かない＝Macでの自己対戦と2012年のiPadで別物にならないため
   （設計書4.4章・査読の致命指摘）。 */

var OKAI = {};

(function () {
  'use strict';

  /* ---- 決まった乱数（種を渡せば Mac でも iPad でも同じ並び） ---- */
  OKAI.makeRnd = function (seed) {
    var s = seed % 2147483647;
    if (s <= 0) { s += 2147483646; }
    return function () {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
  };

  var CORNERS = [0, 7, 56, 63];
  function isCorner(sq) {
    return sq === 0 || sq === 7 || sq === 56 || sq === 63;
  }
  OKAI.CORNERS = CORNERS;
  OKAI.isCorner = isCorner;

  /* ================= 20段の梯子 =================
     呼び名は設計書4.3章の例に合わせる。
     つまみは2つ。梯子は2つの帯でできている。
       ①L1〜L8＝bad（わざと損をする手を打つ確率）を 1.000 から 0 へ下げる。
          badDepth=4（4手先まで読んで、自分が一番損をする手を選ぶ）はL1〜L7で同じ。
          L8は bad=0 ＝ ただのでたらめ（badDepthは使わない）。
       ②L9〜L20＝ふかさ6＋あき12マスから完全読み で固定し、
          eps（たまに でたらめを打つ確率）を 0.933 から 0 へ下げる。
     「1段ごとに変える数字は1つだけ」が成り立つのは、L1〜L7 の中と L9〜L20 の中だけである。
     つなぎ目の2か所ではつまみが入れ替わる＝
       L7→L8＝bad が 0.109→0 になり、同時に badDepth が消える
       L8→L9＝でたらめ から 先読み へ、つまみそのものが変わる
     ここは逆転しないことを自己対戦で直に確かめる（設計書4.4章の「一度に変える要素は1つ」を、
     つなぎ目では満たしていない。実測で担保する）。
     数字の決め方＝2026-09-21のMac実測（p3_result_v2.json ＝ひとつ前の梯子を200局ずつ測った
     19組の勝率をイロ点に直した曲線）から、強さが等間隔になるよう逆算した。 */
  var LADDER = [
    /* 帯①＝わざと損をする確率（bad）。説明は上のヘッダに1か所だけ書く */
    { level: 1, name: 'たまご', kind: 'random', bad: 1.000, badDepth: 4 },
    { level: 2, name: 'ひな', kind: 'random', bad: 0.797, badDepth: 4 },
    { level: 3, name: 'あひる', kind: 'random', bad: 0.640, badDepth: 4 },
    { level: 4, name: 'ひよこ', kind: 'random', bad: 0.492, badDepth: 4 },
    { level: 5, name: 'すずめ', kind: 'random', bad: 0.352, badDepth: 4 },
    { level: 6, name: 'こまどり', kind: 'random', bad: 0.219, badDepth: 4 },
    { level: 7, name: 'ことり', kind: 'random', bad: 0.109, badDepth: 4 },
    { level: 8, name: 'つばめ', kind: 'random', bad: 0 },
    /* ②L9〜L20＝ふかさ6＋あき12マスから完全読み で固定し、eps を 0.933 から 0 へ下げる */
    { level: 9, name: 'はと', kind: 'search', depth: 6, endEmpties: 12, eps: 0.933 },
    { level: 10, name: 'かもめ', kind: 'search', depth: 6, endEmpties: 12, eps: 0.852 },
    { level: 11, name: 'からす', kind: 'search', depth: 6, endEmpties: 12, eps: 0.735 },
    { level: 12, name: 'ふくろう', kind: 'search', depth: 6, endEmpties: 12, eps: 0.664 },
    { level: 13, name: 'きつつき', kind: 'search', depth: 6, endEmpties: 12, eps: 0.596 },
    { level: 14, name: 'くじゃく', kind: 'search', depth: 6, endEmpties: 12, eps: 0.481 },
    { level: 15, name: 'つる', kind: 'search', depth: 6, endEmpties: 12, eps: 0.401 },
    { level: 16, name: 'わし', kind: 'search', depth: 6, endEmpties: 12, eps: 0.316 },
    { level: 17, name: 'たか', kind: 'search', depth: 6, endEmpties: 12, eps: 0.243 },
    { level: 18, name: 'はやぶさ', kind: 'search', depth: 6, endEmpties: 12, eps: 0.171 },
    { level: 19, name: 'ドラゴン', kind: 'search', depth: 6, endEmpties: 12, eps: 0.093 },
    { level: 20, name: 'おうさま', kind: 'search', depth: 6, endEmpties: 12, eps: 0 }
  ];
  OKAI.LADDER = LADDER;

  OKAI.cfgOf = function (level) {
    var c = LADDER[level - 1];
    if (!c) { throw new Error('そのレベルはない: ' + level); }
    return c;
  };

  /* ---- わざと一番わるい手（bad 用）＝見積りが最小になる手を選ぶ。
         badDepth＝どれだけ先を読んで「わるさ」を測るか。1＝置いた直後の見積りだけ。
         2以上＝先まで読んで、自分が本当に損をする手を選ぶ＝もっと弱くなる。 ---- */
  function worstMoveShallow(b, p, moves) {
    var i, sq, flipped, v, worstV = 1e9, worst = moves[0];
    for (i = 0; i < moves.length; i++) {
      sq = moves[i];
      flipped = OK.applyMove(b, sq, p);
      v = OK.evalBoard(b, p);
      OK.undoMove(b, sq, p, flipped);
      if (v < worstV) { worstV = v; worst = sq; }
    }
    return worst;
  }

  function worstMove(b, p, moves, badDepth) {
    var d = badDepth && badDepth > 1 ? badDepth : 1;
    if (d === 1) { return worstMoveShallow(b, p, moves); }
    /* 先まで読む形も、読む局面の数に上限をかける。
       上限に当たったら、置いた直後の見積りだけで選ぶ形に落とす */
    var snapshot = OK.copyBoard(b);
    var i, v, worstV = 1e9, worst = moves[0];
    OK.setBudget(MID_BUDGET);
    OK.resetNodes();
    try {
      for (i = 0; i < moves.length; i++) {
        v = OK.valueOfMoveMid(b, p, moves[i], d);
        if (v < worstV) { worstV = v; worst = moves[i]; }
      }
    } catch (e) {
      OK.clearBudget();
      if (e !== OK.BUDGET_STOP) { throw e; }
      restore(b, snapshot);
      OKAI.lastCost.mid = OK.getNodes();
      return worstMoveShallow(b, p, moves);
    }
    OK.clearBudget();
    OKAI.lastCost.mid = OK.getNodes();
    return worst;
  }

  /* ================= 読む局面の上限（P5＝実機で1手2秒以内を守るため） =================
     時間ではなく「読む局面の数」で決める＝MacでもiPadでも同じ所で止まる。
     換算（工程0.5の実測 othello_kids_speed_20260921.html）＝
       中盤の読み＝1秒に 20,276局面 ／ 終盤の完全読み＝1秒に 166,938局面
     上限の決め方＝
       終盤 150,000局面 → 実機で約0.90秒
       中盤  18,000局面 → 実機で約0.89秒
       終盤の完全読みが上限に当たって中盤の読みへ落ちる場合でも、合計 約1.79秒で2秒に収まる。
     なぜ上限が要るか＝実戦の局面は工程0.5で測った見本より重い。
     実測（node_dist.js・25局×3種）＝ふかさ6の中盤は中央7,643局面だが最悪190,800局面（9.4秒）、
     あき12マスの完全読みは中央98,029局面だが最悪906,901局面（5.4秒）。 */
  var END_BUDGET = 150000;
  var MID_BUDGET = 18000;
  /* 時間の安全弁（ミリ秒）＝端末が見込みより遅かったときだけ効く保険。
     ふつうは上の節点予算が先に効くので、Macでの自己対戦の結果はこれに左右されない。 */
  var TIME_GUARD_MS = 1200;
  OKAI.END_BUDGET = END_BUDGET;
  OKAI.MID_BUDGET = MID_BUDGET;
  OKAI.TIME_GUARD_MS = TIME_GUARD_MS;

  /* 盤を写しから戻す（読みを途中でやめると盤が読みの途中の形で残るため） */
  function restore(b, snapshot) {
    var i;
    for (i = 0; i < 64; i++) { b[i] = snapshot[i]; }
  }

  /* 終盤の完全読み＋上限。上限に当たったら move=-1 を返す＝中盤の読みへ落とす */
  function bestMoveEndBudgeted(b, p, budget) {
    var snapshot = OK.copyBoard(b), r;
    OK.setBudget(budget);
    OK.resetNodes();
    try {
      r = OK.bestMoveEnd(b, p);
    } catch (e) {
      OK.clearBudget();
      if (e !== OK.BUDGET_STOP) { throw e; }
      restore(b, snapshot);
      return { move: -1, gaveUp: true, nodes: OK.getNodes() };
    }
    OK.clearBudget();
    return { move: r.move, gaveUp: false, nodes: OK.getNodes() };
  }
  OKAI.bestMoveEndBudgeted = bestMoveEndBudgeted;

  /* ================= 1手を選ぶ（対局で呼ぶ入口） =================
     b＝盤 / p＝手番 / cfg＝段の設定 / rnd＝決まった乱数
     戻り値＝置くマス（0〜63）。置ける所が無ければ -1。 */
  /* 直前の1手で何局面読んだか（終盤ぶん・中盤ぶんに分けて記録する）。
     終盤をあきらめて中盤の読みへ落ちた手は両方に数が入る＝時間の見積りに使う。 */
  OKAI.lastCost = { end: 0, mid: 0 };

  /* ---- 途中で止められる形（工程2・判定述語P9の後半「画面が固まらない」） ----
     step() を1回呼ぶと「ひとかたまり」だけ読み、まだ決まっていなければ false を返す。
     かたまりの大きさ＝終盤の完全読み1回（上限150,000局面＝実機で約0.9秒）か、
     反復深化のふかさ1つぶん。そのあいだに画面は setTimeout(0) で息をつげる。
     打ち手を決める道すじはこの1本だけにした＝下の chooseMove（いままでの呼び方）は、
     これを最後まで回すだけの薄い皮。Macの自己対戦と画面のアプリが別物にならない。 */
  function Chooser(b, p, cfg, rnd) {
    this.b = b; this.p = p; this.cfg = cfg; this.rnd = rnd;
    this.phase = 'init';
    this.move = -1;
    this.moves = null;
    this.depth = 0;
    this.best = -1;
    this.spentMs = 0;
    this.snapshot = null;
  }

  Chooser.prototype.done = function (sq) {
    this.move = sq;
    this.phase = 'done';
    return true;
  };

  /* 反復深化を打ち切って、いままでで一番よい手を返す */
  Chooser.prototype.endMid = function () {
    OKAI.lastCost.mid = OK.getNodes();
    return this.done(this.best >= 0 ? this.best : this.moves[0]);
  };

  Chooser.prototype.step = function () {
    var cfg = this.cfg, b = this.b, p = this.p, rnd = this.rnd;
    var moves, empties, i, r, cs, t0;

    if (this.phase === 'init') {
      OKAI.lastCost = { end: 0, mid: 0 };
      moves = OK.legalMoves(b, p);
      this.moves = moves;
      if (moves.length === 0) { return this.done(-1); }
      if (moves.length === 1) { return this.done(moves[0]); }

      empties = 64 - OK.discCount(b);

      /* 先読みの段＝でたらめを打つかどうかは、1手につき1回だけ引く。
         （以前は終盤でもう1回引いていたため、eps の意味が終盤だけ違っていた＝査読で判明） */
      if (cfg.kind === 'search' && cfg.eps && rnd() < cfg.eps) {
        return this.done(moves[Math.floor(rnd() * moves.length)]);
      }
      /* おわりの完全読み＝あきマスが少なくなったら最後まで読む。
         読む局面が上限を超えたら あきらめて、中盤の読みへ落ちる（時間を守るため） */
      if (cfg.kind === 'search' && cfg.endEmpties && empties <= cfg.endEmpties) {
        this.phase = 'end';
        return false;
      }
      this.phase = (cfg.kind === 'random') ? 'random' : 'mid';
      return false;
    }

    if (this.phase === 'end') {
      r = bestMoveEndBudgeted(b, p, cfg.endBudget || END_BUDGET);
      OKAI.lastCost.end = r.nodes;
      if (r.move >= 0) { return this.done(r.move); }
      this.phase = 'mid';
      return false;
    }

    if (this.phase === 'random') {
      moves = this.moves;
      /* かどが取れるなら、決めた確率で取る */
      if (cfg.cornerP) {
        cs = [];
        for (i = 0; i < moves.length; i++) {
          if (isCorner(moves[i])) { cs.push(moves[i]); }
        }
        if (cs.length > 0 && rnd() < cfg.cornerP) {
          return this.done(cs[Math.floor(rnd() * cs.length)]);
        }
      }
      /* わざと一番わるい手を打つ（一番よわい段を作るため） */
      if (cfg.bad && rnd() < cfg.bad) {
        return this.done(worstMove(b, p, moves, cfg.badDepth));
      }
      return this.done(moves[Math.floor(rnd() * moves.length)]);
    }

    /* mid＝反復深化＋読む局面の上限。1回の step で ふかさ1つぶんだけ読む。
       上限に当たったら1つ前のふかさの手を返す */
    if (this.snapshot === null) {
      this.snapshot = OK.copyBoard(b);
      this.depth = 0;
      this.best = -1;
      this.spentMs = 0;
      OK.resetNodes();
    }
    this.depth++;
    /* 時間の安全弁（設計書4.4・4.10章）＝段の指定は局面の数のままにしつつ、
       端末が思ったより遅かったときのために、次の深さへ進む前に時計を見る。
       ふつうは節点予算のほうが先に効くので、ここは効かない。
       数えるのは読みに使った時間だけ＝息をついだ時間は入れない（分割しても同じ所で止まる）。 */
    if (this.depth > 1 && this.spentMs > TIME_GUARD_MS) { return this.endMid(); }
    if (this.depth > cfg.depth) { return this.endMid(); }
    OK.setBudget(cfg.budget || MID_BUDGET);
    t0 = OK.now();
    try {
      r = OK.bestMoveMid(b, p, this.depth);
      if (r.move >= 0) { this.best = r.move; }
    } catch (e) {
      OK.clearBudget();
      if (e !== OK.BUDGET_STOP) { throw e; }
      /* 途中でやめた＝盤が読みの途中の形で残っているので写しから戻す */
      restore(b, this.snapshot);
      return this.endMid();
    }
    OK.clearBudget();
    this.spentMs += OK.now() - t0;
    return false;
  };

  /* 画面から使う入口＝1手ぶんの「読み係」を作る */
  OKAI.makeChooser = function (b, p, cfg, rnd) { return new Chooser(b, p, cfg, rnd); };

  /* Macの測定台本から使う入口＝止めずに最後まで読む */
  OKAI.chooseMove = function (b, p, cfg, rnd) {
    var c = new Chooser(b, p, cfg, rnd);
    while (!c.step()) { /* 決まるまで回す */ }
    return c.move;
  };

  /* ================= 子ども代理（6歳の打ちかたの見立て・設計書P3(b)） ================= */

  /* ①「たくさん取る」＝一番多くひっくり返る手を選ぶ（同点なら乱数） */
  function proxyGreedy(b, p, rnd) {
    var moves = OK.legalMoves(b, p);
    if (moves.length === 0) { return -1; }
    var best = [], bestN = -1, i, n;
    for (i = 0; i < moves.length; i++) {
      n = OK.countFlips(b, moves[i], p);
      if (n > bestN) { bestN = n; best = [moves[i]]; }
      else if (n === bestN) { best.push(moves[i]); }
    }
    return best[Math.floor(rnd() * best.length)];
  }

  /* ②「たくさん取る＋かどが取れるときは必ず取る」 */
  function proxyGreedyCorner(b, p, rnd) {
    var moves = OK.legalMoves(b, p);
    if (moves.length === 0) { return -1; }
    var cs = [], i;
    for (i = 0; i < moves.length; i++) {
      if (isCorner(moves[i])) { cs.push(moves[i]); }
    }
    if (cs.length > 0) { return cs[Math.floor(rnd() * cs.length)]; }
    return proxyGreedy(b, p, rnd);
  }

  OKAI.PROXIES = {
    greedy: { key: 'greedy', name: 'たくさん とる', fn: proxyGreedy },
    greedyCorner: { key: 'greedyCorner', name: 'たくさん とる＋かど', fn: proxyGreedyCorner }
  };

  /* ================= 1局うつ =================
     black / white ＝ { type:'level', level:n } または { type:'proxy', key:'greedy' }
     openingPlies ＝ 最初の何手かを乱数で打って、同じ相手どうしでも別の将棋にする数
     戻り値＝ { winner: 1|2|0, blackDiscs, whiteDiscs, moves:[{sq,player}] } */
  function pickBy(spec, b, p, rnd) {
    if (spec.type === 'proxy') { return OKAI.PROXIES[spec.key].fn(b, p, rnd); }
    if (spec.type === 'cfg') { return OKAI.chooseMove(b, p, spec.cfg, rnd); }
    return OKAI.chooseMove(b, p, OKAI.cfgOf(spec.level), rnd);
  }
  OKAI.pickBy = pickBy;

  OKAI.playGame = function (black, white, seed, openingPlies) {
    var b = OK.initBoard(), p = OK.BLACK, rnd = OKAI.makeRnd(seed);
    var passed = false, ply = 0, moves = [], sq, legal;
    var op = (typeof openingPlies === 'number') ? openingPlies : 0;
    while (true) {
      legal = OK.legalMoves(b, p);
      if (legal.length === 0) {
        if (passed) { break; }
        passed = true;
        p = OK.other(p);
        continue;
      }
      passed = false;
      if (ply < op) {
        sq = legal[Math.floor(rnd() * legal.length)];
      } else {
        sq = pickBy(p === OK.BLACK ? black : white, b, p, rnd);
        if (sq < 0) { sq = legal[0]; }
      }
      OK.applyMove(b, sq, p);
      moves.push({ sq: sq, player: p });
      ply++;
      p = OK.other(p);
    }
    var nb = 0, nw = 0, i;
    for (i = 0; i < 64; i++) {
      if (b[i] === OK.BLACK) { nb++; }
      else if (b[i] === OK.WHITE) { nw++; }
    }
    return {
      winner: nb > nw ? OK.BLACK : (nw > nb ? OK.WHITE : 0),
      blackDiscs: nb, whiteDiscs: nw, moves: moves, board: b
    };
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = OKAI; }
