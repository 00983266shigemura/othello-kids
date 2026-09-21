/* つよくなるオセロ ── 悪手の判定器（負けたときの説明のもと）
   2026-09-21 工程1。ES5のみ。core.js を先に load すること。

   設計書4.5章の仕組み＝
     ①対局が終わってから、子の打った手を いちばん強い読み で採点する
     ②最善手との差（損）が しきい値 以上の手だけを「悪手」とする
     ③悪手の中で いちばん損の大きい1手を選ぶ
     ④その手に「型の名前」を付ける。当てはまらなければ名前を付けずに絵と1行だけ出す
     ⑤悪手が1つも無ければ、理由を言わない
   列挙型の条件（「隅の隣に打った→隅を取られた」等）を単独で使わないのは、
   他に手が無い局面でも発火して、避けようのない手を叱るため（査読の致命指摘）。
   採点方式なら、置ける手が全部同じ損の局面は自動的に悪手にならない。 */

var OKB = {};

(function () {
  'use strict';

  /* 採点に使う読み。
     梯子の最上段と同じ「ふかさ6・あき12マス」で採点すると、1局の採点に
     まん中598,984局面・最悪933,155局面かかる＝2012年のiPadで30〜46秒（実測 judge_cost.js）。
     子どもを待たせられないので、採点はこれより浅くする。
     浅くしても、大きな損（かどを渡した等）は見つかる＝P4の試験で確かめる。
     設計書4.5章は「5手読み・終盤10マス完全読み」と書いていた。
     あき10マスにすると、中盤の読み（ふかさ5）が終局まで届いてしまう局面があり、
     そこだけ損の単位が変わる（終局の値は石差×1000で、途中の見積りは数百のため）。
     実測＝じょうずな打ちての手に、あき10マスでは最悪53,541の「損」が出た。
     あき12マスにすると中盤の読みは終局に届かず、最悪156に収まる。よって12マスにする。 */
  var JUDGE_DEPTH = 4;
  var JUDGE_END_EMPTIES = 12;

  /* しきい値。終盤は石の数そのもの、中盤は見積りの目もり。
     中盤のしきい値は、判定器自身の見立て違いより大きく取る。
     実測（judge_noise.js・16局）＝じょうずな打ちての手に出た「損」は
     まん中0・p90=8・p95=17・p99=48。60ならこの誤差の外側になる。
     終盤のしきい値は、中盤と厳しさを揃える。設計書3.2章の「石差4以上」は
     セオリーの型の定義であって、悪手のしきい値としては中盤より緩く、
     4石にすると出る理由の45.8%が「さいごの かぞえ」に偏った（実測 type_dist.js）。
     8石にすると「かど」の話が46.9%・「さいごの かぞえ」が18.8%になり、
     終盤の手数の割合（子の手の14%）と釣り合う。 */
  var END_LOSS_MIN = 12;   /* 終盤＝最善手より12石以上そんをしたら悪手 */
  var MID_LOSS_MIN = 100;  /* 中盤＝見積りで100目もり以上そんをしたら悪手 */

  OKB.JUDGE_DEPTH = JUDGE_DEPTH;
  OKB.JUDGE_END_EMPTIES = JUDGE_END_EMPTIES;
  OKB.setJudgeSearch = function (depth, endEmpties) {
    if (typeof depth === 'number') { JUDGE_DEPTH = depth; }
    if (typeof endEmpties === 'number') { JUDGE_END_EMPTIES = endEmpties; }
  };
  OKB.getJudgeSearch = function () {
    return { depth: JUDGE_DEPTH, endEmpties: JUDGE_END_EMPTIES };
  };
  OKB.setThresholds = function (mid, end) {
    if (typeof mid === 'number') { MID_LOSS_MIN = mid; }
    if (typeof end === 'number') { END_LOSS_MIN = end; }
  };
  OKB.getThresholds = function () { return { mid: MID_LOSS_MIN, end: END_LOSS_MIN }; };

  /* かどの となり（X・C）と、そのかど */
  var NEXT_TO_CORNER = {
    1: 0, 8: 0, 9: 0,
    6: 7, 15: 7, 14: 7,
    48: 56, 57: 56, 49: 56,
    55: 63, 62: 63, 54: 63
  };
  var CORNERS = [0, 7, 56, 63];

  function cornerMovesFor(b, p) {
    var out = [], i;
    for (i = 0; i < CORNERS.length; i++) {
      if (OK.countFlips(b, CORNERS[i], p) > 0) { out.push(CORNERS[i]); }
    }
    return out;
  }

  /* ================= 型の名前を付ける =================
     手がかりは「その手を打つ前の盤」「打ったマス」「その後の実際の進行」。 */
  var TYPES = {
    noCorner: {
      key: 'noCorner', name: 'かどを とらなかった',
      why: 'ここに おいた。でも かどが とれたよ',
      next: 'つぎは かどが とれるとき とろう'
    },
    nextToCorner: {
      key: 'nextToCorner', name: 'かどの となり（とられた）',
      why: 'ここに おいて、かどを とられた',
      next: 'つぎは かどの となりは あけておこう'
    },
    /* あきかどの となりに打ったが、そのあと相手がかどを取らなかった場合。
       「とられた」と言うと事実とちがう（6歳にうその理由を教える）ので文を分ける。 */
    nextToCornerSafe: {
      key: 'nextToCornerSafe', name: 'かどの となり',
      why: 'ここは あいている かどの となり',
      next: 'つぎは かどの となりは あけておこう'
    },
    gaveCorner: {
      key: 'gaveCorner', name: 'かどを わたした',
      why: 'この てで あいてに かどを あげた',
      next: 'つぎは かどを わたさない てを さがそう'
    },
    lostMobility: {
      key: 'lostMobility', name: 'おける ばしょが なくなった',
      why: 'この あと おける ところが へった',
      next: 'つぎは おける ばしょを のこそう'
    },
    tookTooMany: {
      key: 'tookTooMany', name: 'たくさん とりすぎ',
      why: 'ここで たくさん とりすぎた',
      next: 'さいしょは すこしだけ とろう'
    },
    endCount: {
      key: 'endCount', name: 'さいごの かぞえ',
      why: 'さいごの ところで そんを した',
      next: 'さいごは ゆっくり かぞえよう'
    },
    none: {
      key: 'none', name: '',
      why: 'ここは そんを した',
      next: 'つぎは べつの ところも みてみよう'
    }
  };
  OKB.TYPES = TYPES;

  OKB.NO_BLUNDER_TEXT = 'あいてが つよかった。もういっかい やろう';

  /* ================= 採点にかける上限 =================
     判定述語P5は「相手の1手」しか縛っていないが、採点は対局が終わったあとに
     まとめて走るので、そこにも上限が要る（査読の致命指摘・2026-09-21）。
     上限が無いと、実機で最悪21.5秒ほど画面が止まる。
     時間ではなく読む局面の数で決める＝端末に依らない。
     換算は工程0.5の実測（中盤＝1秒20,276局面／終盤＝1秒166,938局面）。
     1局ぶんの上限＝実機で約4秒ぶん。使い切ったら、そこから先の手は採点しない。
     上限を見るのは「次の1手を採点する前」なので、最悪は この上限＋1手ぶん（約1.0秒）
     ＝約5.0秒。判定述語P9前半（5秒）に収まるよう 4,000 にしてある（査読2026-09-21）。 */
  var JUDGE_MS_CAP = 4000;
  /* 1手ぶんの上限（局面の数）＝終盤は実機で約0.90秒、中盤は約0.99秒。
     1手を採点するあいだに走る読みは ぜんぶ この上限の内側で走らせる（査読2026-09-21）。 */
  var END_MOVE_BUDGET = 150000;
  var MID_MOVE_BUDGET = 20000;
  var IPAD_MID_NPS = 20276;
  var IPAD_END_NPS = 166938;
  OKB.JUDGE_MS_CAP = JUDGE_MS_CAP;
  OKB.setJudgeCap = function (ms) {
    if (typeof ms === 'number' && ms > 0) { JUDGE_MS_CAP = ms; }
  };

  /* 1局の採点で読んだ局面の数（中盤ぶん・終盤ぶんに分けて記録する）＝実機の時間の見積りに使う */
  OKB.lastCost = { mid: 0, end: 0 };
  /* 上限に当たって、途中で採点をやめたかどうか */
  OKB.lastCappedAt = -1;

  /* ---- 途中で止められる形（工程2・判定述語P9「そのあいだ画面が固まらない」） ----
     step() を1回呼ぶと 棋譜の1手ぶんだけ進める。まだ終わっていなければ false を返す。
     いちばん重い1手でも上限（終盤150,000局面＝約0.90秒／中盤20,000局面＝約0.99秒）なので、
     その合間に setTimeout(0) で画面が息をつげる。
     採点の道すじはこの1本だけ＝下の judge（いままでの呼び方）は、
     これを最後まで回すだけの薄い皮。Macの試験と画面のアプリが別物にならない。 */
  function Judger(moves, childColor) {
    OKB.lastCost = { mid: 0, end: 0 };
    OKB.lastCappedAt = -1;
    /* 採点のあいだだけ、中盤の読みの終局値を ふつうの見積り に揃える（単位をそろえるため） */
    OK.setMidTerminalAsEval(true);
    this.moves = moves;
    this.childColor = childColor;
    this.b = OK.initBoard();
    this.p = OK.BLACK;
    this.mi = 0;
    this.passes = 0;
    this.spentMs = 0;
    /* いま採点している手の どこまで進んだか＝0 よい手さがし／1 安い見わけ／2 値の出し直し */
    this.stage = 0;
    this.pend = null;
    this.blunders = [];
    this.boards = [];   /* 各手を打つ前の盤の写し（絵に使う） */
    this.turns = [];    /* 各手の手番 */
    this.finished = false;
  }

  /* どこまで進んだか（0〜1）＝画面の「しらべちゅう」の目もりに使う */
  Judger.prototype.progress = function () {
    if (this.moves.length === 0) { return 1; }
    return this.mi / this.moves.length;
  };

  /* 途中でやめる（画面を離れたとき）＝読みの見方を対局用へ戻す */
  Judger.prototype.cancel = function () {
    if (!this.finished) {
      this.finished = true;
      OK.setMidTerminalAsEval(false);
    }
  };

  Judger.prototype.step = function () {
    var moves = this.moves, childColor = this.childColor;
    var b = this.b, p = this.p;
    var legal, sq, empties, best, played, loss, phase;

    if (this.finished) { return true; }
    if (this.mi >= moves.length) { return this.wrapUp(); }

    legal = OK.legalMoves(b, p);
    if (legal.length === 0) {
      /* 両方とも打てないのに手が残っている＝棋譜が壊れている。
         無限に回らないよう、ここで止める（正しい棋譜では起きない）。 */
      this.passes++;
      if (this.passes >= 2) { return this.wrapUp(); }
      this.p = OK.other(p);
      return false;
    }
    this.passes = 0;
    sq = moves[this.mi].sq;
    if (moves[this.mi].player !== p) {
      /* 文はローマ字で書く＝画面の文字に漢字を1字も出さないため（判定述語P7）。
         これは作り手向けの合図であって、子どもには見せない文である。 */
      throw new Error('kifu no teban ga awanai ply=' + this.mi);
    }
    if (this.stage === 0) {     /* 1手につき1回だけ写す（採点を分けても増やさない） */
      this.boards.push(OK.copyBoard(b));
      this.turns.push(p);
    }

    /* 上限を使い切ったら、そこから先の手は採点しない（画面を止めないため）。
       採点した範囲の中で いちばん損の大きい手を出す。
       採点を始めた手は、始めた以上 最後まで見る（this.stage > 0）。 */
    if (p === childColor && legal.length >= 2
        && (this.stage > 0 || this.spentMs < JUDGE_MS_CAP)) {
      /* 1手の採点は「よい手さがし」→「安い見わけ」→「値の出し直し」の3つに分ける。
         1回の step で走らせるのは このうち1つだけ＝どれも1手ぶんの上限の内側なので、
         画面が止まる いちばん長い時間が 上限を超えない（査読2026-09-21）。
         もとは 後ろの2つが上限の外に出ていて、最悪1.55秒 止まっていた。
         分けただけなので、読む中身と 採点の結果は 前と1つも変わらない。 */
      if (this.stage === 0) {
        empties = 64 - OK.discCount(b);
        this.pend = { isEnd: (empties <= JUDGE_END_EMPTIES) };
      }
      if (this.spentMs >= JUDGE_MS_CAP) {
        /* 途中で1局ぶんの上限に達した＝この手は採点しないで先へ進む */
        this.stage = 0;
        this.pend = null;
        OK.applyMove(b, sq, p);
        this.p = OK.other(p);
        this.mi++;
        return false;
      }
      var isEnd = this.pend.isEnd, snap = OK.copyBoard(b), gaveUp = false, ri;
      var budget = isEnd ? END_MOVE_BUDGET : MID_MOVE_BUDGET;
      OK.setBudget(budget);
      OK.resetNodes();
      try {
        if (this.stage === 0) {
          this.pend.best = isEnd ? OK.bestMoveEnd(b, p).value
                                 : OK.bestMoveMid(b, p, JUDGE_DEPTH).value;
        } else if (this.stage === 1) {
          /* まず「しきい値ぶん損をしているか」だけを安く調べ、
             損をしている手だけ、値そのものを出し直す（重い読みを減らすため） */
          this.pend.big = isEnd
            ? OK.moveValueAtMostEnd(b, p, sq, this.pend.best - END_LOSS_MIN)
            : OK.moveValueAtMostMid(b, p, sq, JUDGE_DEPTH, this.pend.best - MID_LOSS_MIN);
        } else {
          this.pend.played = isEnd ? OK.valueOfMoveEnd(b, p, sq)
                                   : OK.valueOfMoveMid(b, p, sq, JUDGE_DEPTH);
        }
      } catch (e2) {
        OK.clearBudget();
        if (e2 !== OK.BUDGET_STOP) { throw e2; }
        for (ri = 0; ri < 64; ri++) { b[ri] = snap[ri]; }
        gaveUp = true;
      }
      OK.clearBudget();
      if (isEnd) { OKB.lastCost.end += gaveUp ? budget : OK.getNodes(); }
      else { OKB.lastCost.mid += gaveUp ? budget : OK.getNodes(); }
      this.spentMs = OKB.lastCost.mid / IPAD_MID_NPS * 1000
                   + OKB.lastCost.end / IPAD_END_NPS * 1000;
      if (this.spentMs >= JUDGE_MS_CAP && OKB.lastCappedAt < 0) {
        OKB.lastCappedAt = this.mi;
      }
      if (gaveUp) {
        /* 上限に当たった手は採点しない（悪手として扱わない） */
        this.stage = 0;
        this.pend = null;
        OK.applyMove(b, sq, p);
        this.p = OK.other(p);
        this.mi++;
        return false;
      }
      if (this.stage === 0) { this.stage = 1; return false; }
      if (this.stage === 1) {
        if (this.pend.big) { this.stage = 2; return false; }
        this.pend.played = this.pend.best;   /* 悪手ではない＝損0として扱う */
      }
      phase = isEnd ? 'end' : 'mid';
      best = this.pend.best;
      played = this.pend.played;
      this.stage = 0;
      this.pend = null;
      loss = best - played;
      if (loss >= (phase === 'end' ? END_LOSS_MIN : MID_LOSS_MIN)) {
        this.blunders.push({
          ply: this.mi, sq: sq, loss: loss, phase: phase,
          /* しきい値で割った値＝中盤と終盤の損を同じものさしで比べるため */
          ratio: loss / (phase === 'end' ? END_LOSS_MIN : MID_LOSS_MIN),
          legalCount: legal.length, flips: OK.countFlips(b, sq, p)
        });
      }
    }
    OK.applyMove(b, sq, p);
    this.p = OK.other(p);
    this.mi++;
    return false;
  };

  Judger.prototype.wrapUp = function () {
    this.finished = true;
    OK.setMidTerminalAsEval(false);   /* 採点はここまで＝対局用の見方へ戻す */
    return true;
  };

  /* ================= 1局を採点する =================
     moves ＝ playGame が返す [{sq, player}]／ childColor ＝ OK.BLACK か OK.WHITE
     戻り値＝ { blunders:[…], worst:{…}|null } */
  Judger.prototype.result = function () {
    var blunders = this.blunders, i, worst;
    if (blunders.length === 0) { return { blunders: [], worst: null }; }
    worst = blunders[0];
    for (i = 1; i < blunders.length; i++) {
      if (blunders[i].ratio > worst.ratio) { worst = blunders[i]; }
    }
    worst.type = nameType(worst, this.boards, this.turns, this.moves, this.childColor);
    worst.boardBefore = this.boards[worst.ply];
    worst.oppCorner = cornerTakenAfter(this.moves, worst.ply, this.childColor);
    return { blunders: blunders, worst: worst };
  };

  /* 画面から使う入口＝1局ぶんの「採点係」を作る */
  OKB.makeJudger = function (moves, childColor) { return new Judger(moves, childColor); };

  /* Macの試験台本から使う入口＝止めずに最後まで採点する */
  OKB.judge = function (moves, childColor) {
    var j = new Judger(moves, childColor);
    while (!j.step()) { /* 終わるまで回す */ }
    return j.result();
  };

  /* その手のあと4手いないに、相手がかどを取ったか（絵に印を付けるため） */
  function cornerTakenAfter(moves, ply, childColor) {
    var i, m;
    for (i = ply + 1; i < moves.length && i <= ply + 4; i++) {
      m = moves[i];
      if (m.player !== childColor && NEXT_TO_CORNER[m.sq] === undefined) {
        if (m.sq === 0 || m.sq === 7 || m.sq === 56 || m.sq === 63) { return m.sq; }
      }
    }
    return -1;
  }

  function nameType(bl, boards, turns, moves, childColor) {
    var b0 = boards[bl.ply], p = childColor, opp = OK.other(p), sq = bl.sq;

    /* ①かどが取れたのに取らなかった */
    var cm = cornerMovesFor(b0, p);
    if (cm.length > 0 && !(sq === 0 || sq === 7 || sq === 56 || sq === 63)) {
      return TYPES.noCorner;
    }

    /* 打った後の盤を作る */
    var b1 = OK.copyBoard(b0);
    OK.applyMove(b1, sq, p);

    /* ②かどの となり に打って、あいたかどを相手に取られた */
    var c = NEXT_TO_CORNER[sq];
    if (c !== undefined && b0[c] === OK.EMPTY) {
      if (cornerTakenAfter(moves, bl.ply, childColor) >= 0) { return TYPES.nextToCorner; }
      return TYPES.nextToCornerSafe;
    }

    /* ③この手で、相手がかどに打てるようになった */
    var before = cornerMovesFor(b0, opp).length;
    var after = cornerMovesFor(b1, opp).length;
    if (after > before) { return TYPES.gaveCorner; }

    /* ④終盤の数えそこない */
    if (bl.phase === 'end') { return TYPES.endCount; }

    /* ⑤この手の後、自分の置ける場所が減った（相手が1手返した時点で2つ以下、またはパス） */
    var myNext = legalCountAfterReply(moves, bl.ply, childColor, b1);
    if (myNext >= 0 && myNext <= 2) { return TYPES.lostMobility; }

    /* ⑥序盤でたくさん取りすぎた＝20手目まで（設計書3.2「さいしょは すこしだけ とる」） */
    if (bl.ply < 20 && bl.flips >= 4) { return TYPES.tookTooMany; }

    return TYPES.none;
  }

  /* 子が打ち、相手が1手返した時点で、子に置ける場所がいくつ残っているか。
     0＝パス（打つ所が無い）。相手の手が棋譜に無ければ -1（判定しない）。 */
  function legalCountAfterReply(moves, ply, childColor, boardAfterChildMove) {
    var i, b = OK.copyBoard(boardAfterChildMove), opp = OK.other(childColor);
    for (i = ply + 1; i < moves.length; i++) {
      if (moves[i].player === opp) {
        OK.applyMove(b, moves[i].sq, opp);
        return OK.legalMoves(b, childColor).length;
      }
      /* 次が自分の手＝相手がパスした＝相手の手は無い */
      return OK.legalMoves(b, childColor).length;
    }
    return -1;
  }

  /* ================= 画面に出す形にする（設計書4.5章の4部品） ================= */
  OKB.describe = function (result) {
    if (!result.worst) {
      return { hasReason: false, why: OKB.NO_BLUNDER_TEXT, next: '', type: '' };
    }
    var w = result.worst;
    return {
      hasReason: true,
      type: w.type.key,
      typeName: w.type.name,
      why: w.type.why,
      next: w.type.next,
      sq: w.sq,
      loss: w.loss,
      phase: w.phase,
      board: w.boardBefore,
      oppCorner: w.oppCorner
    };
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = OKB; }
