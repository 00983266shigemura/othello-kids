/* つよくなるオセロ ── 画面と そうさ と おと
   2026-09-21 工程2。ES5のみ（2012年のiPad・Safari 10.1で動く書き方だけ）。
   core.js / ai.js / blunder.js / rules.js / text.js を先に load すること。

   この中の いちばん だいじな仕組み＝「ひとかたまり ずつ 読ませて、あいだに 息をつぐ」。
   相手の1手は最悪 約1.8秒、まけた わけの しらべ は最悪 約3.3秒かかる（実機の見込み）。
   まとめて走らせると そのあいだ画面が止まり、押しても なにも起きない。
   そこで ai.js の makeChooser と blunder.js の makeJudger（どちらも工程2で作った
   「途中で止められる形」）を setTimeout(0) で少しずつ進める＝判定述語P9の後半。 */

var OKUI = {};

(function () {
  'use strict';

  /* このファイルを直したら この数字を +1 する。version.txt にも同じ数字が書かれる
     （build_app.py が自動で書く）＝古いファイルを持っている端末が取り直せる。 */
  OKUI.APP_VERSION = 7;

  /* まけた わけの しらべ を、何ミリ秒ぶん まとめて 進めてから 息をつぐか。
     0 にすると かたまりは いちばん小さくなるが、60手ぶん 待ち時間が積み上がる。
     30 にすると、画面が止まる いちばん長い時間は
     「30ミリ秒＋その最後にはじめた1手ぶん」＝実機で約0.93秒（実測 chunk_check.js）。
     この最悪値を決めているのは「おわりの完全読み1回（150,000局面＝約0.90秒）」で、
     完全読みは途中でやめると完全でなくなるため、これ以上は小さくできない。 */
  OKUI.JUDGE_BATCH_MS = 30;

  var BLACK = 1, WHITE = 2, EMPTY = 0;

  /* ================= 小さな道具 ================= */
  function el(id) { return document.getElementById(id); }
  function mk(tag, cls) {
    var d = document.createElement(tag);
    if (cls) { d.className = cls; }
    return d;
  }
  function setText(node, s) {
    if (!node) { return; }
    while (node.firstChild) { node.removeChild(node.firstChild); }
    node.appendChild(document.createTextNode(s));
  }
  function show(node, on) { if (node) { node.style.display = on ? '' : 'none'; } }
  function addClass(node, c) {
    if ((' ' + node.className + ' ').indexOf(' ' + c + ' ') < 0) { node.className += ' ' + c; }
  }
  function delClass(node, c) {
    node.className = (' ' + node.className + ' ').split(' ' + c + ' ').join(' ')
      .replace(/^\s+|\s+$/g, '');
  }
  /* 見た目の計算をその場でやり直させる合図＝同じ動きをもう一度 走らせたいときに使う */
  function reflow(node) { var dummy; if (node) { dummy = node.offsetWidth; } return dummy; }
  /* 端末の中の保存箱。設定によっては さわるだけで つまずくので、ここで受けとめる
     （査読2026-09-21＝つまずくと 起動そのものが失敗していた） */
  function store() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  /* ================= いまの ようす ================= */
  var S = {
    screen: 'mode',
    save: null,
    level: 1,
    childColor: BLACK,
    duo: false,        /* ふたりで あそぶ＝相手も人が打つ。記録にも れべるにも ひびかない */
    board: null,
    player: BLACK,
    moves: [],
    passedLast: false,
    busy: false,       /* 石がひっくり返っている・相手が考えている＝押しても効かない */
    missCount: 0,      /* この手番で はさめない所を押した回数＝イエローカードの まい数 */
    check: false,      /* たしかめ中＝おく所 → はさむ じぶんの いし の2だんで 置く */
    target: -1,        /* たしかめ中に えらんだ おく所（-1＝まだ） */
    ft: 0,             /* この局で はさめない所を1回も押さずに置けた手の数 */
    tn: 0,             /* この局で 置いた手の数（ひとりの ときの 子の手だけ） */
    chooser: null,
    judger: null,
    rnd: null,
    cells: [],
    stones: [],
    pressSq: -1,
    usedTouch: false,
    timers: []
  };
  OKUI.state = S;

  function later(fn, ms) {
    var t = setTimeout(fn, ms);
    S.timers.push(t);
    return t;
  }
  function clearTimers() {
    var i;
    for (i = 0; i < S.timers.length; i++) { clearTimeout(S.timers[i]); }
    S.timers = [];
  }

  /* ================= おと（合成・ファイルは持たない） =================
     設計書4.6章。webkitAudioContext の接頭辞つき。最初のタップで解錠する。
     すべての音は ensureAudio() を通る＝試験用の複製は ここを塞ぐだけで無音にできる。 */
  var actx = null;
  OKUI.ensureAudio = function () {
    if (!S.save || !S.save.sound) { return null; }
    if (actx) { return actx; }
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) { return null; }
      actx = new C();
    } catch (e) { return null; }
    return actx;
  };

  function tone(freq, start, dur, type, vol) {
    var ctx = OKUI.ensureAudio();
    if (!ctx) { return; }
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      g.gain.value = 0;
      var t0 = ctx.currentTime + start;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol === undefined ? 0.18 : vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e2) { /* 鳴らなくても あそべる */ }
  }

  /* 最初のタップで音の錠を外す（iOS の決まり） */
  function unlockAudio() {
    var ctx = OKUI.ensureAudio();
    if (!ctx) { return; }
    try {
      if (ctx.state === 'suspended' && ctx.resume) { ctx.resume(); }
      var o = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + 0.01);
    } catch (e) { /* 通らなくても進む */ }
  }

  var SND = {
    /* 置いた＝短い前打音→4度上（コイン音の骨格）0.15秒 */
    place: function () { tone(784, 0, 0.05, 'triangle', 0.16); tone(1047, 0.045, 0.12, 'triangle', 0.16); },
    /* 置けない＝小さめ・丸い音・2度下がる「ポコッ」0.2秒。ブザーは使わない */
    deny: function () { tone(330, 0, 0.09, 'sine', 0.10); tone(294, 0.08, 0.12, 'sine', 0.09); },
    /* かち＝長調の駆け上がり＋きらきら 2〜3秒 */
    win: function () {
      var n = [523, 659, 784, 1047], i;
      for (i = 0; i < n.length; i++) { tone(n[i], i * 0.13, 0.35, 'triangle', 0.17); }
      var sp = [1568, 1319, 1760, 2093, 1568], j;
      for (j = 0; j < sp.length; j++) { tone(sp[j], 0.6 + j * 0.16, 0.3, 'sine', 0.08); }
    },
    /* まけ＝下がる・やわらかい音・こわくしない 1.5秒 */
    lose: function () {
      var n = [440, 392, 349, 294], i;
      for (i = 0; i < n.length; i++) { tone(n[i], i * 0.2, 0.45, 'sine', 0.12); }
    },
    /* ひきわけ＝まんなかの音 1つだけ */
    draw: function () { tone(392, 0, 0.5, 'sine', 0.12); tone(523, 0.18, 0.5, 'sine', 0.10); },
    /* れべるが ひらいた＝かち音の変奏＋ひとつ高い おわり 2秒 */
    unlock: function () {
      var n = [523, 659, 784, 1047, 1319], i;
      for (i = 0; i < n.length; i++) { tone(n[i], i * 0.12, 0.3, 'triangle', 0.16); }
      tone(1568, 0.7, 0.8, 'triangle', 0.15);
    }
  };
  OKUI.SND = SND;

  /* ================= 画面の 切りかえ ================= */
  var SCREENS = ['mode', 'map', 'game', 'result'];
  function showScreen(name) {
    var i;
    S.screen = name;
    for (i = 0; i < SCREENS.length; i++) {
      show(el('scr-' + SCREENS[i]), SCREENS[i] === name);
    }
    window.scrollTo(0, 0);
    reloadIfIdle();
  }

  /* ================= 大きさを その場で 決める =================
     CSS の新しい書き方（min() など）は古いSafariに無いので、JSで px を計算して入れる。 */
  function layout() {
    var h = window.innerHeight || document.documentElement.clientHeight;
    var host = el('game-row'), wrap = el('board-wrap'), sideBox = el('side'), board = el('board');
    var cell, boardPx, availW, sideW, gap = 14;
    if (!board) { return; }
    /* 使える横はば＝画面そのものではなく、まわりの余白を引いた中身の幅で測る
       （余白を数え落とすと、ばんと しらせが 横に並ばず 下へ落ちる） */
    availW = host.clientWidth || window.innerWidth || 600;
    /* よこ長のときは ばんを7割にして、のこりに しらせ を置く。
       0.70 は 2012年のiPad（よこ向き・はば1024）で 1マス約88px＝約1.7cm になる値＝
       設計書4.1章の「1マス約88pt」に合わせてある。 */
    cell = Math.floor(Math.min(availW * 0.70, h - 16) / 8);
    if (cell < 24) { cell = 24; }
    boardPx = cell * 8;
    sideW = availW - boardPx - gap;
    /* しらせの置き場が せますぎるときは、ばんの下へ まわす（たて長のとき） */
    if (sideW < 190) {
      cell = Math.floor(Math.min(availW, h * 0.60) / 8);
      if (cell < 24) { cell = 24; }
      boardPx = cell * 8;
      wrap.style.cssFloat = 'none';
      sideBox.style.cssFloat = 'none';
      sideBox.style.width = 'auto';
      wrap.style.marginRight = '0';
    } else {
      wrap.style.cssFloat = 'left';
      sideBox.style.cssFloat = 'left';
      sideBox.style.width = sideW + 'px';
      wrap.style.marginRight = gap + 'px';
    }
    board.style.width = boardPx + 'px';
    board.style.height = boardPx + 'px';
    wrap.style.width = boardPx + 'px';
    wrap.style.height = boardPx + 'px';
    var i, c;
    for (i = 0; i < 64; i++) {
      c = S.cells[i];
      if (!c) { continue; }
      c.style.left = ((i & 7) * cell) + 'px';
      c.style.top = ((i >> 3) * cell) + 'px';
      c.style.width = cell + 'px';
      c.style.height = cell + 'px';
    }
  }
  OKUI.layout = layout;

  /* ================= ばん を 作る ================= */
  function buildBoard() {
    var board = el('board'), i, c, st;
    while (board.firstChild) { board.removeChild(board.firstChild); }
    S.cells = [];
    S.stones = [];
    for (i = 0; i < 64; i++) {
      c = mk('div', 'cell');
      c.setAttribute('data-sq', String(i));
      st = mk('div', 'st');
      c.appendChild(st);
      board.appendChild(c);
      S.cells.push(c);
      S.stones.push(st);
    }
  }

  /* 盤の絵を いまの ようす に合わせる。置ける場所の印は ぜったいに つけない（P1） */
  function renderBoard() {
    var i, v;
    for (i = 0; i < 64; i++) {
      v = S.board[i];
      S.stones[i].className = 'st' + (v === BLACK ? ' b' : (v === WHITE ? ' w' : ''));
    }
  }

  /* いしの かず を 石の列＋小さい数字 で出す（しげ裁定Q4＝A案） */
  function renderCounts() {
    var nb = 0, nw = 0, i;
    for (i = 0; i < 64; i++) {
      if (S.board[i] === BLACK) { nb++; }
      else if (S.board[i] === WHITE) { nw++; }
    }
    if (S.duo) {
      /* ふたりのときは「きみ・あいて」が だれを指すか 決められない＝色だけで出す */
      drawCount(el('count-you'), nb, BLACK, '');
      drawCount(el('count-ai'), nw, WHITE, '');
      return;
    }
    drawCount(el('count-you'), S.childColor === BLACK ? nb : nw,
      S.childColor, OKT.game.you);
    drawCount(el('count-ai'), S.childColor === BLACK ? nw : nb,
      S.childColor === BLACK ? WHITE : BLACK, OKT.game.ai);
  }

  function drawCount(box, n, color, label) {
    var i, row, d;
    while (box.firstChild) { box.removeChild(box.firstChild); }
    d = mk('div', 'cnt-label');
    setText(d, (label ? label + ' ' : '')
      + (color === BLACK ? OKT.game.black : OKT.game.white));
    box.appendChild(d);
    row = mk('div', 'cnt-row');
    for (i = 0; i < n; i++) {
      row.appendChild(mk('span', 'dot ' + (color === BLACK ? 'b' : 'w')));
    }
    box.appendChild(row);
    d = mk('div', 'cnt-num');
    setText(d, String(n));
    box.appendChild(d);
  }

  /* ================= メッセージ（文は2秒で消す） ================= */
  var msgTimer = null;
  /* keep＝消さずに残す（いちばん困っている場面の声かけ用・しげ裁定2026-09-22） */
  function say(s, kind, keep) {
    var m = el('msg');
    setText(m, s);
    m.className = 'msg' + (kind ? ' ' + kind : '');
    show(m, s !== '');
    if (msgTimer) { clearTimeout(msgTimer); msgTimer = null; }
    if (s !== '' && !keep) {
      msgTimer = setTimeout(function () { show(m, false); }, 2000);
    }
  }

  /* ================= はじめの がめん＝あそびかたを えらぶ ================= */
  function buildMode() {
    setText(el('mode-help'), OKT.mode.help);
    setText(el('mode-solo'), OKT.mode.solo);
    setText(el('mode-solo-note'), OKT.mode.soloNote);
    setText(el('mode-duo'), OKT.mode.duo);
    setText(el('mode-duo-note'), OKT.mode.duoNote);
    setText(el('mode-enter-how'), OKT.grown.enterHow);
  }

  /* ================= れべるの ちず ================= */
  function buildMap() {
    var grid = el('map-grid'), i, cell, no, nm, marks, mb, mw, cfg, open, done;
    setText(el('map-back'), OKT.mode.back);
    setText(el('map-title'), OKT.map.title);
    setText(el('map-help'), OKT.map.help);
    setText(el('map-enter-how'), OKT.grown.enterHow);
    while (grid.firstChild) { grid.removeChild(grid.firstChild); }
    for (i = 1; i <= OKR.LEVELS; i++) {
      cfg = OKAI.cfgOf(i);
      open = OKR.isOpen(S.save, i);
      done = OKR.isCleared(S.save, i);
      cell = mk('div', 'lv' + (open ? ' open' : ' locked') + (done ? ' done' : ''));
      cell.setAttribute('data-lv', String(i));
      no = mk('div', 'lv-no');
      setText(no, String(i));
      cell.appendChild(no);
      nm = mk('div', 'lv-name');
      setText(nm, open ? cfg.name : OKT.map.locked);
      cell.appendChild(nm);
      marks = mk('div', 'lv-marks');
      mb = mk('span', 'm b' + (OKR.wonWith(S.save, i, BLACK) ? ' on' : ''));
      setText(mb, OKR.wonWith(S.save, i, BLACK) ? '✓' : '●');
      mw = mk('span', 'm w' + (OKR.wonWith(S.save, i, WHITE) ? ' on' : ''));
      setText(mw, OKR.wonWith(S.save, i, WHITE) ? '✓' : '○');
      marks.appendChild(mb);
      marks.appendChild(mw);
      cell.appendChild(marks);
      grid.appendChild(cell);
    }
    buildStamps();
  }

  function buildStamps() {
    var box = el('map-stamps'), i, n, d, any = false, t;
    while (box.firstChild) { box.removeChild(box.firstChild); }
    t = mk('div', 'stamp-title');
    setText(t, OKT.map.stampTitle);
    box.appendChild(t);
    for (i = 0; i < OKR.STAMPS.length; i++) {
      n = S.save.stamps[OKR.STAMPS[i].key] || 0;
      if (n <= 0) { continue; }
      any = true;
      d = mk('span', 'stamp');
      setText(d, OKR.STAMPS[i].name + ' ' + n);
      box.appendChild(d);
    }
    if (!any) {
      d = mk('span', 'stamp none');
      setText(d, OKT.map.stampNone);
      box.appendChild(d);
    }
  }

  /* いろ を えらぶ まど */
  function askColor(level) {
    var box = el('pick');
    setText(el('pick-title'), OKT.map.pickTitle + '（' + OKT.map.levelWord + ' '
      + level + '・' + OKAI.cfgOf(level).name + '）');
    setText(el('pick-black'), OKT.map.pickBlack);
    setText(el('pick-white'), OKT.map.pickWhite);
    setText(el('pick-back'), OKT.map.pickBack);
    box.setAttribute('data-lv', String(level));
    show(box, true);
  }

  /* ================= たいきょく ================= */
  function startGame(level, color, duo) {
    clearTimers();
    S.duo = !!duo;
    S.level = level;
    S.childColor = color;
    S.board = OK.initBoard();
    S.player = BLACK;
    S.moves = [];
    S.passedLast = false;
    S.missCount = 0;
    S.check = false;
    S.target = -1;
    S.ft = 0;
    S.tn = 0;
    S.busy = false;
    S.chooser = null;
    if (S.judger) { S.judger.cancel(); S.judger = null; }
    /* 種＝いま の 時こく。同じ相手でも毎回ちがう将棋になる */
    S.rnd = OKAI.makeRnd(((new Date()).getTime() % 2147483000) + 7);
    show(el('lecture'), false);
    drawCards();
    /* 「ちずに もどる」は たいきょくちゅう ずっと 出しておく（しげ指示2026-09-22）。
       押すと すぐには もどらず、quit の ききかえし を はさむ */
    setText(el('give-up'), S.duo ? OKT.game.quitDuo : OKT.game.quit);
    show(el('give-up'), true);
    show(el('quit'), false);
    say('');
    showScreen('game');
    renderBoard();
    renderCounts();
    layout();
    turnLoop();
  }
  OKUI.startGame = startGame;

  function turnLabel() {
    var t = el('turn');
    if (S.duo) {
      setText(t, (S.player === BLACK ? OKT.game.black : OKT.game.white)
        + OKT.game.turnSuffix);
      t.className = 'turn you';
      return;
    }
    if (S.player === S.childColor) {
      setText(t, OKT.game.yourTurn + '（'
        + (S.childColor === BLACK ? OKT.game.black : OKT.game.white) + '）');
      t.className = 'turn you';
    } else {
      setText(t, OKT.game.aiTurn);
      t.className = 'turn ai';
    }
  }

  /* 手番を1つ進める。置ける所が無ければ自動でパス（設計書4.2章） */
  function turnLoop() {
    var legal = OK.legalMoves(S.board, S.player);
    turnLabel();
    if (legal.length === 0) {
      if (S.passedLast) { endGame(); return; }
      /* 相手も打てない＝ここで おしまい。終わりの場面で「パス！」（つづく合図）を
         出さない（査読2026-09-21）。盤が うまった ときも ここを通る */
      if (OK.legalMoves(S.board, OK.other(S.player)).length === 0) { endGame(); return; }
      S.passedLast = true;
      say(S.duo
        ? ((S.player === BLACK ? OKT.game.black : OKT.game.white) + OKT.game.passSuffix)
        : (S.player === S.childColor ? OKT.game.passYou : OKT.game.passAi), 'warn');
      S.busy = true;
      later(function () {
        S.busy = false;
        S.player = OK.other(S.player);
        turnLoop();
      }, 1500);
      return;
    }
    S.passedLast = false;
    /* ふたりのときは どちらの手番でも 人が押す＝相手の読みは走らせない */
    if (S.duo || S.player === S.childColor) { S.busy = false; return; }
    aiThink();
  }

  /* ---- 相手の1手＝ひとかたまりずつ読んで、あいだに息をつぐ（判定述語P5・P9） ---- */
  function aiThink() {
    var cfg = OKAI.cfgOf(S.level), t0 = (new Date()).getTime();
    S.busy = true;
    S.chooser = OKAI.makeChooser(S.board, S.player, cfg, S.rnd);
    function pump() {
      var done;
      if (S.screen !== 'game' || !S.chooser) { return; }
      done = S.chooser.step();
      if (!done) { later(pump, 0); return; }
      var sq = S.chooser.move, wait;
      S.chooser = null;
      if (sq < 0) { S.busy = false; turnLoop(); return; }
      /* はやすぎると「相手が打った」ことに気づけないので、すこし待つ */
      wait = 350 - ((new Date()).getTime() - t0);
      later(function () { doMove(sq); }, wait > 0 ? wait : 0);
    }
    later(pump, 0);
  }

  /* 石を置いて、1枚ずつ返す（0.4秒）。返し終わったら次の手番へ */
  function doMove(sq) {
    var p = S.player, flipped = OK.applyMove(S.board, sq, p);
    S.moves.push({ sq: sq, player: p });
    S.stones[sq].className = 'st ' + (p === BLACK ? 'b' : 'w') + ' put';
    SND.place();
    renderCounts();
    var i = 0, step = flipped.length > 0 ? Math.max(40, Math.floor(400 / flipped.length)) : 0;
    function flipOne() {
      if (i >= flipped.length) {
        delClass(S.stones[sq], 'put');
        S.player = OK.other(S.player);
        turnLoop();
        return;
      }
      /* いちど flip を外して 計算をやり直させてから 付け直す＝
         2回目に返る石でも ひっくり返る動きが もう一度 走る（査読2026-09-21） */
      var st = S.stones[flipped[i]], base = 'st ' + (p === BLACK ? 'b' : 'w');
      st.className = base;
      reflow(st);
      st.className = base + ' flip';
      i++;
      renderCounts();
      later(flipOne, step);
    }
    S.busy = true;
    later(flipOne, step);
  }

  /* ---- 子が ばん を 押したとき（設計書4.2章の表そのまま） ---- */
  function tapCell(sq) {
    if (S.busy || S.screen !== 'game') { return; }
    if (!S.duo && S.player !== S.childColor) { return; }
    var cell = S.board[sq];
    /* たしかめ中で おく所が きまっている＝じぶんの いしを押したら「はさむ いし」の こたえ */
    if (S.check && S.target >= 0 && cell === S.player) {
      if (OKR.anchorOk(S.board, S.target, S.player, sq)) {
        place(S.target);
        return;
      }
      shake(sq);
      SND.deny();
      say(OKT.game.checkWrong, 'warn');
      addCard();
      return;
    }
    /* 石のある所＝指の ずれ（うっかり）が多い。カードは ふやさない（評価の正本 第3章） */
    if (cell !== EMPTY) {
      shake(sq);
      SND.deny();
      say((S.check && S.target >= 0) ? OKT.game.checkOwn : OKT.game.occupied, 'warn');
      return;
    }
    if (OK.countFlips(S.board, sq, S.player) === 0) {
      shake(sq);
      SND.deny();
      say(OKT.game.noFlip, 'warn');
      applyLecture();
      setTarget(-1);
      S.check = true;
      addCard();
      return;
    }
    /* たしかめ中は すぐ置かず、はさむ いしを 聞く */
    if (S.check) {
      setTarget(sq);
      say(OKT.game.checkAsk, 'warn', true);
      return;
    }
    place(sq);
  }
  OKUI.tapCell = tapCell;

  function place(sq) {
    if (S.missCount === 0) { S.ft++; }
    S.tn++;
    S.missCount = 0;
    S.check = false;
    setTarget(-1);
    drawCards();
    show(el('lecture'), false);
    say('');      /* 消さずに残していた声かけを、置けたところで下げる */
    doMove(sq);
  }

  /* たしかめ中に えらんだ おく所に しるしを つける（置ける場所を 示すのでは ない＝
     子が じぶんで えらんだ マス だけ） */
  function setTarget(sq) {
    if (S.target >= 0 && S.cells[S.target]) { delClass(S.cells[S.target], 'target'); }
    S.target = sq;
    if (sq >= 0 && S.cells[sq]) { addClass(S.cells[sq], 'target'); }
  }

  /* はさめない所を押したら ルールの絵を 1回めから 出す。
     どちらでも 置ける場所は ぜったいに 示さない（しげ裁定Q1＝A案） */
  function applyLecture() {
    setText(el('lecture-text'), OKT.game.lecture);
    setText(el('lecture-how'), OKT.game.lectureHow);
    show(el('lecture'), true);
    startRuleAnim();
  }

  /* ---- イエローカード＝この手番の まちがいの 見える化。まけには しない（しげ裁定「Cで」） ---- */
  function addCard() {
    S.missCount++;
    drawCards();
  }
  function drawCards() {
    var row = el('foul-cards'), i;
    while (row.firstChild) { row.removeChild(row.firstChild); }
    for (i = 0; i < S.missCount; i++) { row.appendChild(mk('span', 'ycard on')); }
    setText(el('foul-text'), OKT.game.checkHow);
    show(el('foul'), S.missCount > 0);
  }

  /* ルールの絵＝よこ1れつで「くろ・しろ・あき」に置くと返る、小さな うごき */
  var ruleTimer = null, rulePhase = 0;
  function startRuleAnim() {
    var strip = el('rule-strip');
    if (ruleTimer) { return; }
    function draw() {
      var seq, i, d;
      rulePhase = (rulePhase + 1) % 4;
      /* 0,1＝くろ ○ ○ あき／2,3＝くろ くろ くろ くろ（はさんで返った形） */
      seq = (rulePhase < 2) ? ['b', 'w', 'w', 'e'] : ['b', 'b', 'b', 'b'];
      while (strip.firstChild) { strip.removeChild(strip.firstChild); }
      for (i = 0; i < seq.length; i++) {
        d = mk('span', 'rs ' + seq[i]);
        strip.appendChild(d);
      }
    }
    draw();
    ruleTimer = setInterval(draw, 900);
  }
  function stopRuleAnim() {
    if (ruleTimer) { clearInterval(ruleTimer); ruleTimer = null; }
  }

  function shake(sq) {
    var c = S.cells[sq];
    addClass(c, 'shake');
    later(function () { delClass(c, 'shake'); }, 400);
  }

  /* ================= 対局が おわった ================= */
  function endGame() {
    var nb = 0, nw = 0, i, mine, theirs, win, lose;
    stopRuleAnim();
    for (i = 0; i < 64; i++) {
      if (S.board[i] === BLACK) { nb++; }
      else if (S.board[i] === WHITE) { nw++; }
    }
    mine = S.childColor === BLACK ? nb : nw;
    theirs = S.childColor === BLACK ? nw : nb;
    win = mine > theirs;
    lose = mine < theirs;
    S.result = { nb: nb, nw: nw, mine: mine, theirs: theirs, win: win, lose: lose };
    showResultHead();
    showScreen('result');
    /* ふたりのときは まけた わけ を しらべない＝
       どちらの色で しらべるかを 決められないうえ、記録にも のこさないため */
    if (S.duo) {
      finishResult(null);
      if (nb === nw) { SND.draw(); } else { SND.win(); confetti(); }
      return;
    }
    if (lose) {
      SND.lose();
      startJudging();
    } else {
      finishResult(null);
      if (win) { /* かちの音は finishResult で れべる解放と ならべて鳴らす */ }
      else { SND.draw(); }
    }
  }

  function showResultHead() {
    var r = S.result, box, kachi;
    if (S.duo) {
      kachi = r.nb === r.nw ? null : (r.nb > r.nw ? BLACK : WHITE);
      setText(el('res-head'), kachi === null ? OKT.result.draw
        : ((kachi === BLACK ? OKT.game.black : OKT.game.white) + OKT.result.winSuffix));
      el('res-head').className = 'res-head ' + (kachi === null ? 'draw' : 'win');
    } else {
      setText(el('res-head'), r.win ? OKT.result.win : (r.lose ? OKT.result.lose : OKT.result.draw));
      el('res-head').className = 'res-head ' + (r.win ? 'win' : (r.lose ? 'lose' : 'draw'));
    }
    box = el('res-counts');
    while (box.firstChild) { box.removeChild(box.firstChild); }
    if (S.duo) {
      drawCount(box.appendChild(mk('div', 'cnt')), r.nb, BLACK, '');
      drawCount(box.appendChild(mk('div', 'cnt')), r.nw, WHITE, '');
    } else {
      drawCount(box.appendChild(mk('div', 'cnt')), r.mine, S.childColor, OKT.game.you);
      drawCount(box.appendChild(mk('div', 'cnt')), r.theirs,
        S.childColor === BLACK ? WHITE : BLACK, OKT.game.ai);
    }
    /* やり方の承認＝行動の事実を1つだけ（設計書4.5章）。
       ふたりのときは どちらの手を ほめるか 決められないので 出さない */
    var got = S.duo ? [] : OKR.stampsOf(S.moves, S.childColor), pick = 'last', i;
    for (i = 0; i < got.length; i++) {
      if (got[i] === 'corner') { pick = 'corner'; break; }
      if (got[i] === 'pass') { pick = 'pass'; }
      else if (got[i] === 'edge' && pick === 'last') { pick = 'edge'; }
    }
    S.gotStamps = got;
    setText(el('res-praise'), S.duo ? '' : OKT.result.praise[pick]);
    show(el('res-reason'), false);
    show(el('res-judging'), false);
    setText(el('res-unlock'), '');
    setText(el('res-again'), OKT.result.again);
    setText(el('res-back'), S.duo ? OKT.result.backDuo : OKT.result.back);
  }

  /* ---- まけた わけ を しらべる＝棋譜を1手ずつ。あいだに息をつぐ（判定述語P9） ---- */
  function startJudging() {
    var box = el('res-judging'), bar = el('judge-bar');
    setText(el('judge-text'), OKT.result.judging);
    show(box, true);
    bar.style.width = '0%';
    S.judger = OKB.makeJudger(S.moves, S.childColor);
    var t0 = (new Date()).getTime();
    function pump() {
      var done = false, tick = (new Date()).getTime();
      if (S.screen !== 'result' || !S.judger) { return; }
      /* 軽い手は まとめて 進める（1手ごとに息をつぐと 60回も待つことになるため）。
         重い手は1つで返ってくる＝いちばん重い1手でも上限150,000局面 */
      while (!done && ((new Date()).getTime() - tick) < OKUI.JUDGE_BATCH_MS) {
        done = S.judger.step();
      }
      bar.style.width = Math.round(S.judger.progress() * 100) + '%';
      if (!done) { later(pump, 0); return; }
      var res = S.judger.result();
      S.judgeMs = (new Date()).getTime() - t0;
      S.judger = null;
      show(box, false);
      finishResult(OKB.describe(res));
    }
    later(pump, 0);
  }

  /* けっか画面の のこり（理由・れべる解放・記録の書き込み） */
  function finishResult(reason) {
    var r = S.result, opened = 0, rec;
    if (reason && reason.hasReason) {
      setText(el('res-why'), reason.why);
      setText(el('res-next'), reason.next);
      setText(el('res-reason-title'), OKT.result.reasonTitle);
      setText(el('res-next-title'), OKT.result.nextTitle);
      drawMini(reason.board, reason.sq, reason.oppCorner);
      show(el('res-reason'), true);
    } else if (reason) {
      setText(el('res-why'), OKB.NO_BLUNDER_TEXT);
      setText(el('res-next'), '');
      setText(el('res-reason-title'), '');
      setText(el('res-next-title'), '');
      show(el('res-mini'), false);
      show(el('res-reason'), true);
    }

    /* ふたりのときは 記録に のこさない＝自分どうしで かたせて
       れべるを ひらけてしまうと、梯子の意味が なくなるため */
    if (S.duo) {
      setText(el('res-saveng'), '');
      setText(el('res-unlock'), '');
      return;
    }

    if (r.win) { opened = OKR.markWin(S.save, S.level, S.childColor); }
    OKR.addStamps(S.save, S.gotStamps || []);
    rec = {
      t: (new Date()).getTime(),
      lv: S.level,
      color: S.childColor === BLACK ? 'b' : 'w',
      res: r.win ? 'w' : (r.lose ? 'l' : 'd'),
      mine: r.mine, theirs: r.theirs,
      reason: (reason && reason.hasReason) ? reason.type : '',
      ft: S.ft, tn: S.tn
    };
    OKR.addGame(S.save, rec);
    OKR.addFirstTry(S.save, rec.t, S.ft, S.tn);
    /* 保存できないことは 結果の画面に書く＝#msg は たいきょくの画面の中にあり、
       ここでは親ごと隠れていて見えないため（査読2026-09-21） */
    setText(el('res-saveng'), '');
    if (!OKR.save(store(), S.save)) { setText(el('res-saveng'), OKT.error.saveNg); }

    if (opened > 0) {
      setText(el('res-unlock'), OKT.result.unlocked);
      SND.unlock();
      confetti();
    } else if (r.win) {
      setText(el('res-unlock'),
        OKR.isCleared(S.save, S.level) ? '' : OKT.result.needOther);
      SND.win();
      confetti();
    } else if (!r.lose) {
      setText(el('res-unlock'), OKT.result.drawNote);
    }
    buildMap();
  }

  /* 悪手の直前の ばん を 小さく 描く（打ったマスに橙の ！） */
  function drawMini(board, sq, oppCorner) {
    var box = el('res-mini'), i, d, c;
    show(box, true);
    while (box.firstChild) { box.removeChild(box.firstChild); }
    for (i = 0; i < 64; i++) {
      c = mk('div', 'mc');
      if (board[i] === BLACK) { addClass(c, 'b'); }
      else if (board[i] === WHITE) { addClass(c, 'w'); }
      if (i === sq) {
        addClass(c, 'mark');
        d = mk('span', 'bang');
        setText(d, '！');
        c.appendChild(d);
      } else if (i === oppCorner && oppCorner >= 0) {
        addClass(c, 'taken');
        d = mk('span', 'bang');
        setText(d, '✕');
        c.appendChild(d);
      }
      box.appendChild(c);
    }
    setText(el('res-mini-note'),
      (oppCorner >= 0) ? OKT.result.miniNoteTaken : OKT.result.miniNote);
  }

  /* かち の かみふぶき（2〜3秒・はですぎない） */
  function confetti() {
    var box = el('confetti'), i, d, cols = ['#0072B2', '#E69F00', '#CC79A7', '#56B4E9', '#F0E442'];
    while (box.firstChild) { box.removeChild(box.firstChild); }
    show(box, true);
    for (i = 0; i < 24; i++) {
      d = mk('span', 'cf');
      d.style.left = Math.floor(Math.random() * 96) + '%';
      d.style.background = cols[i % cols.length];
      d.style.animationDelay = (Math.random() * 0.8) + 's';
      d.style.webkitAnimationDelay = d.style.animationDelay;
      box.appendChild(d);
    }
    later(function () { show(box, false); }, 2600);
  }

  /* ================= おうちのひと（大人むけ） ================= */
  var lockAns = 0, pressTimer = null;

  function askLock() {
    var a = 3 + Math.floor(Math.random() * 7), b = 4 + Math.floor(Math.random() * 6);
    lockAns = a + b;
    setText(el('lock-q'), a + ' + ' + b + ' = ?');
    setText(el('lock-title'), OKT.grown.lockTitle);
    setText(el('lock-close'), OKT.grown.close);
    el('lock-input').value = '';
    setText(el('lock-ng'), '');
    show(el('lock'), true);
  }

  function openGrown() {
    show(el('lock'), false);
    buildGrown();
    show(el('grown'), true);
  }

  function buildGrown() {
    var box = el('grown-body'), i, g, d, tbl, tr, counts, k, name, any, rows;
    setText(el('grown-title'), OKT.grown.title);
    setText(el('grown-close'), OKT.grown.close);
    setText(el('g-sound'), S.save.sound ? OKT.grown.soundOn : OKT.grown.soundOff);
    setText(el('g-openall'), S.save.openAll ? OKT.grown.openAllDone : OKT.grown.openAll);
    setText(el('g-openall-note'), S.save.openAll ? '' : OKT.grown.openAllNote);
    setText(el('g-wipe'), OKT.grown.wipe);
    while (box.firstChild) { box.removeChild(box.firstChild); }

    /* きょうの こえかけ＝いちばん あたらしい まけ の わけ から選ぶ */
    d = mk('h3', null);
    setText(d, OKT.grown.voiceTitle);
    box.appendChild(d);
    d = mk('p', 'voice');
    setText(d, pickVoice());
    box.appendChild(d);

    /* はじめの 1かいで おけた わりあい（しゅうごと）＝学習が 伸びたかの ものさし */
    d = mk('h3', null);
    setText(d, OKT.grown.firstTitle);
    box.appendChild(d);
    d = mk('p', null);
    setText(d, OKT.grown.firstNote);
    box.appendChild(d);
    rows = OKR.weekRows(S.save);
    if (rows.length === 0) {
      d = mk('p', null);
      setText(d, OKT.grown.firstNone);
      box.appendChild(d);
    } else {
      tbl = mk('table', 'gtbl');
      for (i = 0; i < rows.length; i++) {
        tr = mk('tr', null);
        appendCell(tr, 'th', rows[i].m + '/' + rows[i].d + ' ' + OKT.grown.firstWeek);
        appendCell(tr, 'td', rows[i].pct + '%');
        appendCell(tr, 'td', rows[i].tn + ' ' + OKT.grown.firstMoves);
        tbl.appendChild(tr);
      }
      box.appendChild(tbl);
    }

    /* まけた わけ の かいすう */
    d = mk('h3', null);
    setText(d, OKT.grown.reasonsTitle);
    box.appendChild(d);
    counts = OKR.reasonCounts(S.save);
    any = false;
    tbl = mk('table', 'gtbl');
    for (k in counts) {
      if (!counts.hasOwnProperty(k)) { continue; }
      any = true;
      tr = mk('tr', null);
      name = (k === 'foul') ? OKT.grown.foulName
        : ((OKB.TYPES[k] && OKB.TYPES[k].name) ? OKB.TYPES[k].name : k);
      appendCell(tr, 'th', name === '' ? OKB.TYPES.none.why : name);
      appendCell(tr, 'td', String(counts[k]));
      tbl.appendChild(tr);
    }
    if (any) { box.appendChild(tbl); } else {
      d = mk('p', null);
      setText(d, OKT.grown.reasonsNone);
      box.appendChild(d);
    }

    /* できた こと の かいすう */
    d = mk('h3', null);
    setText(d, OKT.grown.stampsTitle);
    box.appendChild(d);
    tbl = mk('table', 'gtbl');
    for (i = 0; i < OKR.STAMPS.length; i++) {
      tr = mk('tr', null);
      appendCell(tr, 'th', OKR.STAMPS[i].name);
      appendCell(tr, 'td', String(S.save.stamps[OKR.STAMPS[i].key] || 0));
      tbl.appendChild(tr);
    }
    box.appendChild(tbl);

    /* あそんだ きろく */
    d = mk('h3', null);
    setText(d, OKT.grown.gamesTitle);
    box.appendChild(d);
    if (S.save.games.length === 0) {
      d = mk('p', null);
      setText(d, OKT.grown.gamesNone);
      box.appendChild(d);
    } else {
      tbl = mk('table', 'gtbl');
      for (i = 0; i < S.save.games.length; i++) {
        g = S.save.games[i];
        if (!g) { continue; }   /* 壊れた記録が混じっていても 落ちない（査読2026-09-21） */
        tr = mk('tr', null);
        appendCell(tr, 'td', OKT.map.levelWord + ' ' + g.lv);
        appendCell(tr, 'td', g.color === 'b' ? OKT.grown.colBlack : OKT.grown.colWhite);
        appendCell(tr, 'td', g.res === 'w' ? OKT.grown.colWin
          : (g.res === 'l' ? OKT.grown.colLose : OKT.grown.colDraw));
        appendCell(tr, 'td', g.mine + ' - ' + g.theirs);
        /* 型の名前が無い「ここは そんを した」も、上の表と同じ言い方で出す
           （上の表は文、この表は空白、と食い違っていた＝査読2026-09-21） */
        appendCell(tr, 'td', g.reason === 'foul' ? OKT.grown.foulName
          : (g.reason && OKB.TYPES[g.reason]
            ? (OKB.TYPES[g.reason].name || OKB.TYPES[g.reason].why) : ''));
        tbl.appendChild(tr);
      }
      box.appendChild(tbl);
    }

    d = mk('p', 'ver');
    setText(d, OKT.grown.versionLabel + ' ' + OKUI.APP_VERSION);
    box.appendChild(d);
  }

  function appendCell(tr, tag, s) {
    var c = mk(tag, null);
    setText(c, s);
    tr.appendChild(c);
    return c;
  }

  function pickVoice() {
    var i, g;
    for (i = 0; i < S.save.games.length; i++) {
      g = S.save.games[i];
      if (!g) { continue; }   /* 壊れた記録が混じっていても 落ちない（査読2026-09-21） */
      if (g.res === 'l') {
        if (g.reason && OKT.grown.voice[g.reason]) { return OKT.grown.voice[g.reason]; }
        return OKT.grown.voice.none;
      }
    }
    return OKT.grown.voice.noLose;
  }

  /* ================= 版の 取りなおし（設計書4.10章・おかえりクエストと同型） ================= */
  var UPD_KEY = 'othelloKids_upd';
  function tidyUrl() {
    if (!window.history || !history.replaceState) { return; }
    if (location.search.indexOf('v=') < 0) { return; }
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* 見ためだけ */ }
  }
  function checkUpdate() {
    var x;
    if (!window.XMLHttpRequest) { return; }
    try { x = new XMLHttpRequest(); } catch (e) { return; }
    try { x.open('GET', 'version.txt?t=' + (new Date()).getTime(), true); } catch (e2) { return; }
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || x.status !== 200) { return; }
      var v = parseInt(String(x.responseText).replace(/[^0-9]/g, ''), 10);
      var now = (new Date()).getTime(), last = null, part;
      if (!(v > OKUI.APP_VERSION)) { return; }
      try { last = sessionStorage.getItem(UPD_KEY); } catch (e3) { /* 無くても進む */ }
      if (last) {
        part = String(last).split(':');
        if (part[0] === String(v) && (now - parseInt(part[1], 10)) < 30000) { return; }
      }
      /* あそんでいる さいちゅうに 取り直すと 局が消えるので、ちずに いるときだけ
         取り直す（査読2026-09-21）。対局中なら 次に ちずへ もどった ときに 取り直す */
      if (S.screen !== 'map' && S.screen !== 'mode') { return; }
      try { sessionStorage.setItem(UPD_KEY, v + ':' + now); } catch (e4) { /* 無くても進む */ }
      location.replace('./?v=' + v);
    };
    try { x.send(null); } catch (e5) { /* 通信できない置き方でも あそべる */ }
  }

  /* ================= つうしんが なくても あそべる（はんすう5・2026-09-23 しげ指示） =================
     古いiPad（iOS 10）には 新しい しくみ（Service Worker）が無いので、Application Cache
     （offline.appcache に書いた ファイルを 端末に しまう しくみ）を使う。
     新しい版を しまい終えたら、ちず か はじめの画面に いるときだけ 入れかえる
     （たいきょく中に 入れかえると 局が消えるため＝checkUpdate と同じ きまり）。 */
  var cacheReady = false;
  function reloadIfIdle() {
    if (!cacheReady) { return; }
    if (S.screen !== 'map' && S.screen !== 'mode') { return; }
    cacheReady = false;
    location.reload();
  }
  function watchCache() {
    var ac = window.applicationCache;
    if (!ac || !ac.addEventListener) { return; }
    ac.addEventListener('updateready', function () {
      try { ac.swapCache(); } catch (e) { /* 入れかえは つぎに ひらいたときに おきる */ }
      cacheReady = true;
      reloadIfIdle();
    }, false);
  }

  /* ================= 押したときの 受けとり ================= */
  function sqFromEvent(ev) {
    var t = ev.target, n = 0;
    while (t && n < 4) {
      if (t.getAttribute && t.getAttribute('data-sq') !== null) {
        return parseInt(t.getAttribute('data-sq'), 10);
      }
      t = t.parentNode;
      n++;
    }
    return -1;
  }

  /* いまの指の位置にある マスを 取る（無ければ -1） */
  function sqFromTouch(ev) {
    var t = ev.touches && ev.touches[0], node;
    if (!t || !document.elementFromPoint) { return S.pressSq; }
    node = document.elementFromPoint(t.clientX, t.clientY);
    if (!node) { return -1; }
    return sqFromEvent({ target: node });
  }

  function bind() {
    var board = el('board'), grid = el('map-grid');

    /* 「置く」＝同じマスの中で 触れて 離したとき だけ（設計書4.1章） */
    board.onmousedown = function (ev) {
      if (S.usedTouch) { return; }
      S.pressSq = sqFromEvent(ev);
      if (S.pressSq >= 0) { addClass(S.cells[S.pressSq], 'press'); }
    };
    board.onmouseup = function (ev) {
      if (S.usedTouch) { return; }
      var sq = sqFromEvent(ev);
      if (S.pressSq >= 0) { delClass(S.cells[S.pressSq], 'press'); }
      unlockAudio();
      if (sq >= 0 && sq === S.pressSq) { tapCell(sq); }
      S.pressSq = -1;
    };
    board.ontouchstart = function (ev) {
      S.usedTouch = true;
      S.pressSq = sqFromEvent(ev);
      if (S.pressSq >= 0) { addClass(S.cells[S.pressSq], 'press'); }
      if (ev.preventDefault) { ev.preventDefault(); }   /* 2回たたきの拡大を止める */
    };
    board.ontouchmove = function (ev) {
      /* 指で さわっているときの ev.target は 最初のマスのまま 変わらないので、
         いまの指の位置から マスを 取り直す（査読2026-09-21） */
      var sq = sqFromTouch(ev);
      if (S.pressSq >= 0 && sq !== S.pressSq) {
        delClass(S.cells[S.pressSq], 'press');
        S.pressSq = -1;   /* 指がマスの外へ動いた＝置かない */
      }
      if (ev.preventDefault) { ev.preventDefault(); }
    };
    board.ontouchend = function (ev) {
      var sq = S.pressSq;
      if (sq >= 0) { delClass(S.cells[sq], 'press'); }
      S.pressSq = -1;
      unlockAudio();
      if (sq >= 0) { tapCell(sq); }
      if (ev.preventDefault) { ev.preventDefault(); }
    };

    /* ちず＝レベルを えらぶ */
    grid.onclick = function (ev) {
      var t = ev.target, n = 0, lv = -1;
      unlockAudio();
      while (t && n < 4) {
        if (t.getAttribute && t.getAttribute('data-lv') !== null) {
          lv = parseInt(t.getAttribute('data-lv'), 10);
          break;
        }
        t = t.parentNode;
        n++;
      }
      if (lv < 1) { return; }
      if (!OKR.isOpen(S.save, lv)) { SND.deny(); return; }
      askColor(lv);
    };

    el('pick-black').onclick = function () {
      show(el('pick'), false);
      startGame(parseInt(el('pick').getAttribute('data-lv'), 10), BLACK);
    };
    el('pick-white').onclick = function () {
      show(el('pick'), false);
      startGame(parseInt(el('pick').getAttribute('data-lv'), 10), WHITE);
    };
    el('pick-back').onclick = function () { show(el('pick'), false); };

    /* 「ちずに もどる」＝まちがって 押したときの ために 1回 聞きかえす。
       押すと その局は すてる（記録に のこさない）ので、取り消せないため */
    el('give-up').onclick = function () {
      setText(el('quit-ask'), OKT.game.quitAsk);
      setText(el('quit-yes'), OKT.game.quitYes);
      setText(el('quit-no'), OKT.game.quitNo);
      show(el('quit'), true);
    };
    el('quit-no').onclick = function () { show(el('quit'), false); };
    el('quit-yes').onclick = function () {
      show(el('quit'), false);
      clearTimers();
      stopRuleAnim();
      showScreen(S.duo ? 'mode' : 'map');
    };
    el('res-again').onclick = function () {
      startGame(S.level, S.childColor, S.duo);
    };
    el('res-back').onclick = function () {
      clearTimers();
      if (S.judger) { S.judger.cancel(); S.judger = null; }
      showScreen(S.duo ? 'mode' : 'map');
    };

    /* ---- はじめの がめん＝あそびかたを えらぶ ---- */
    el('mode-solo').onclick = function () { showScreen('map'); };
    el('mode-duo').onclick = function () { startGame(S.level, BLACK, true); };
    el('map-back').onclick = function () { showScreen('mode'); };

    /* おうちのひと＝画面のすみを3秒 長おし → たしざん */
    function startPress() {
      if (pressTimer) { return; }
      pressTimer = setTimeout(function () { pressTimer = null; askLock(); }, 3000);
    }
    function endPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }
    /* ちず と はじめの がめん の どちらからでも 入れるように、同じ仕掛けを2つに掛ける */
    function bindGrown(gb) {
      if (!gb) { return; }
      setText(gb, OKT.grown.enter);
      gb.onmousedown = startPress;
      gb.onmouseup = endPress;
      gb.onmouseout = endPress;
      gb.ontouchstart = function (ev) {
        startPress();
        if (ev.preventDefault) { ev.preventDefault(); }
      };
      gb.ontouchend = endPress;
      gb.ontouchcancel = endPress;
    }
    bindGrown(el('grown-btn'));
    bindGrown(el('mode-grown'));

    el('lock-ok').onclick = function () {
      if (parseInt(el('lock-input').value, 10) === lockAns) { openGrown(); }
      else { setText(el('lock-ng'), OKT.grown.lockNg); }
    };
    el('lock-close').onclick = function () { show(el('lock'), false); };
    el('grown-close').onclick = function () { show(el('grown'), false); };

    el('g-sound').onclick = function () {
      S.save.sound = !S.save.sound;
      OKR.save(store(), S.save);
      setText(el('g-sound'), S.save.sound ? OKT.grown.soundOn : OKT.grown.soundOff);
      if (S.save.sound) { unlockAudio(); SND.place(); }
    };
    el('g-openall').onclick = function () {
      S.save.openAll = true;
      OKR.save(store(), S.save);
      setText(el('g-openall'), OKT.grown.openAllDone);
      setText(el('g-openall-note'), '');
      buildMap();
    };
    el('g-wipe').onclick = function () {
      setText(el('wipe-ask'), OKT.grown.wipeAsk);
      setText(el('wipe-yes'), OKT.grown.wipeYes);
      setText(el('wipe-no'), OKT.grown.wipeNo);
      show(el('wipe'), true);
    };
    el('wipe-yes').onclick = function () {
      /* 自分の鍵だけを消す＝clear() は使わない（同じ公開先の他のアプリを壊さない） */
      S.save = OKR.wipe(store());
      show(el('wipe'), false);
      buildMap();
      buildGrown();
      setText(el('g-openall'), OKT.grown.openAll);
      setText(el('g-openall-note'), OKT.grown.openAllNote);
    };
    el('wipe-no').onclick = function () { show(el('wipe'), false); };

    window.onresize = layout;
    window.onorientationchange = function () { later(layout, 200); };
  }

  /* ================= はじまり ================= */
  OKUI.start = function () {
    try {
      S.save = OKR.load(store());
      setText(el('app-name'), OKT.appName);
      setText(el('mode-name'), OKT.appName);
      buildMode();
      buildBoard();
      buildMap();
      bind();
      showScreen('mode');
      layout();
      tidyUrl();
      watchCache();
      checkUpdate();
      setInterval(checkUpdate, 300000);
    } catch (e) {
      var box = el('fatal');
      if (box) {
        setText(el('fatal-title'), OKT.error.title);
        /* つまずいた中身は画面に出さない＝そこに漢字が混ざると判定述語P7を破るため */
        setText(el('fatal-body'), OKT.error.body);
        show(box, true);
      }
    }
  };
})();
