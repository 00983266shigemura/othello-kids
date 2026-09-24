/* つよくなるオセロ ── 記録ときまり（画面に触らない部分）
   2026-09-21 工程2。ES5のみ・DOMを使わない＝Macの試験台本からそのまま動かせる。
   core.js を先に load すること。

   ここに置くもの＝レベルの開きかた（判定述語P2）・端末内の保存・できたことスタンプ・
   置けないマスを押したあとの「たしかめ」の判定・はじめの1かいで おけた わりあい。
   画面の組み立て（ui.js）と分けてあるのは、ここだけを jsc で試験できるようにするため。 */

var OKR = {};

(function () {
  'use strict';

  var LEVELS = 20;
  OKR.LEVELS = LEVELS;

  /* 端末内の保存の鍵。othelloKids_ で始まる鍵しか使わない＝
     同じ公開先に住む「おかえりクエスト」の記録を壊さないため（設計書2.1章）。
     localStorage.clear() は全消去になるので、この道具では1度も使わない。 */
  var KEY = 'othelloKids_save';
  OKR.KEY = KEY;
  OKR.KEYS = [KEY];

  /* ---- まっさらな記録 ---- */
  OKR.newSave = function () {
    return {
      v: 1,
      won: {},        /* won[レベル] = { black: true/false, white: true/false } */
      stamps: {},     /* stamps[しるしの名] = 回数 */
      games: [],      /* 終わった対局の記録（新しい順・50局まで） */
      weeks: {},      /* weeks[しゅうの はじめ YYYYMMDD] = { ft, tn }（はじめの1かいで おけた わりあい） */
      sound: true,
      openAll: false  /* おうちのひと画面で「ぜんぶ ひらく」を押したか */
    };
  };

  /* 古い形・壊れた形でも落ちないように整える */
  OKR.normalize = function (s) {
    var base = OKR.newSave(), k;
    if (!s || typeof s !== 'object') { return base; }
    for (k in base) {
      if (base.hasOwnProperty(k) && s[k] !== undefined && s[k] !== null) { base[k] = s[k]; }
    }
    if (typeof base.won !== 'object') { base.won = {}; }
    if (typeof base.stamps !== 'object') { base.stamps = {}; }
    if (Object.prototype.toString.call(base.games) !== '[object Array]') { base.games = []; }
    /* 中身の形まで整える＝壊れた記録を読ませても落ちない（査読2026-09-21） */
    var kk, clean = {}, arr = [], i;
    for (kk in base.won) {
      if (base.won.hasOwnProperty(kk)) {
        clean[kk] = {
          black: !!(base.won[kk] && base.won[kk].black),
          white: !!(base.won[kk] && base.won[kk].white)
        };
      }
    }
    base.won = clean;
    clean = {};
    for (kk in base.stamps) {
      if (base.stamps.hasOwnProperty(kk)) {
        clean[kk] = (typeof base.stamps[kk] === 'number' && base.stamps[kk] > 0)
          ? Math.floor(base.stamps[kk]) : 0;
      }
    }
    base.stamps = clean;
    clean = {};
    if (typeof base.weeks !== 'object') { base.weeks = {}; }
    for (kk in base.weeks) {
      if (base.weeks.hasOwnProperty(kk) && base.weeks[kk]
          && base.weeks[kk].tn > 0 && base.weeks[kk].ft >= 0) {
        clean[kk] = { ft: Math.floor(base.weeks[kk].ft), tn: Math.floor(base.weeks[kk].tn) };
      }
    }
    base.weeks = clean;
    for (i = 0; i < base.games.length; i++) {
      if (base.games[i] && typeof base.games[i] === 'object') { arr.push(base.games[i]); }
    }
    base.games = arr;
    base.sound = !!base.sound;
    base.openAll = !!base.openAll;
    return base;
  };

  /* ---- 読み書き（try-catch で囲む＝私的ブラウズでは書けないことがある） ---- */
  OKR.load = function (store) {
    var raw = null;
    try { raw = store.getItem(KEY); } catch (e) { return OKR.newSave(); }
    if (!raw) { return OKR.newSave(); }
    try { return OKR.normalize(JSON.parse(raw)); } catch (e2) { return OKR.newSave(); }
  };

  OKR.save = function (store, s) {
    try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  };

  /* やりなおし＝自分の鍵だけを消す。clear() は使わない（他のアプリの記録まで消えるため） */
  OKR.wipe = function (store) {
    var i;
    for (i = 0; i < OKR.KEYS.length; i++) {
      try { store.removeItem(OKR.KEYS[i]); } catch (e) { /* 消せなくても進む */ }
    }
    return OKR.newSave();
  };

  /* ================= レベルの開きかた（判定述語P2） ================= */

  OKR.wonWith = function (s, level, color) {
    var w = s.won[String(level)];
    if (!w) { return false; }
    return color === OK.BLACK ? !!w.black : !!w.white;
  };

  /* そのレベルは「くろでも しろでも 勝った」か */
  OKR.isCleared = function (s, level) {
    return OKR.wonWith(s, level, OK.BLACK) && OKR.wonWith(s, level, OK.WHITE);
  };

  /* そのレベルで遊べるか＝1段目はいつでも／それ以外は1つ前を両方の色で勝っていること */
  OKR.isOpen = function (s, level) {
    if (level < 1 || level > LEVELS) { return false; }
    if (s.openAll) { return true; }
    if (level === 1) { return true; }
    return OKR.isCleared(s, level - 1);
  };

  OKR.openCount = function (s) {
    var n = 0, i;
    for (i = 1; i <= LEVELS; i++) { if (OKR.isOpen(s, i)) { n++; } }
    return n;
  };

  /* 勝ちを書き込む。戻り値＝この1勝で新しく開いたレベル（開かなければ0） */
  OKR.markWin = function (s, level, color) {
    var key = String(level), openedBefore = OKR.isOpen(s, level + 1);
    if (!s.won[key]) { s.won[key] = { black: false, white: false }; }
    if (color === OK.BLACK) { s.won[key].black = true; } else { s.won[key].white = true; }
    if (!openedBefore && OKR.isOpen(s, level + 1) && level + 1 <= LEVELS) { return level + 1; }
    return 0;
  };

  /* ================= できたこと スタンプ（勝ち負けと別に貯まる） ================= */
  var STAMPS = [
    { key: 'corner', name: 'かどを とった' },
    { key: 'edge', name: 'はしを つかった' },
    { key: 'pass', name: 'パスさせた' },
    { key: 'last', name: 'さいごまで うった' }
  ];
  OKR.STAMPS = STAMPS;

  function isCorner(sq) { return sq === 0 || sq === 7 || sq === 56 || sq === 63; }
  function isEdge(sq) {
    var r = sq >> 3, c = sq & 7;
    if (isCorner(sq)) { return false; }
    return r === 0 || r === 7 || c === 0 || c === 7;
  }

  /* 終わった1局から、その局で取れたスタンプの名を出す。
     moves ＝ [{sq, player}]（最後まで打ち切った棋譜）／ childColor ＝ 子の色 */
  OKR.stampsOf = function (moves, childColor) {
    var got = {}, i, prevPlayer = -1;
    for (i = 0; i < moves.length; i++) {
      if (moves[i].player === childColor) {
        if (isCorner(moves[i].sq)) { got.corner = true; }
        if (isEdge(moves[i].sq)) { got.edge = true; }
        /* 自分の手が2回つづいた＝あいてに置く所が無かった＝パスさせた */
        if (prevPlayer === childColor) { got.pass = true; }
      }
      prevPlayer = moves[i].player;
    }
    got.last = true;   /* 最後まで打ち切った局でしか呼ばない */
    var out = [], k;
    for (k = 0; k < STAMPS.length; k++) {
      if (got[STAMPS[k].key]) { out.push(STAMPS[k].key); }
    }
    return out;
  };

  OKR.addStamps = function (s, keys) {
    var i, k;
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      s.stamps[k] = (s.stamps[k] || 0) + 1;
    }
  };

  OKR.stampName = function (key) {
    var i;
    for (i = 0; i < STAMPS.length; i++) { if (STAMPS[i].key === key) { return STAMPS[i].name; } }
    return key;
  };

  /* ================= 対局の記録（おうちのひと画面で見る） ================= */
  var MAX_GAMES = 50;
  OKR.MAX_GAMES = MAX_GAMES;

  OKR.addGame = function (s, rec) {
    s.games.unshift(rec);
    while (s.games.length > MAX_GAMES) { s.games.pop(); }
  };

  /* 負け理由の出た回数を数える（おうちのひと画面の表） */
  OKR.reasonCounts = function (s) {
    var out = {}, i, r;
    for (i = 0; i < s.games.length; i++) {
      r = s.games[i] && s.games[i].reason;   /* 壊れた記録が混じっていても落ちない */
      if (r) { out[r] = (out[r] || 0) + 1; }
    }
    return out;
  };

  /* ================= たしかめ（2026-09-24 しげ裁定「Cで」） =================
     はさめない所を押したら、その手番だけ「おく所 → はさむ じぶんの いし」の2だんで置く。
     ねらい＝当てずっぽうを止めるだけでなく、はさめるかを たしかめる手順そのものを練習させる
     （評価の正本＝vault 30_generated/reports/othello_kids_foul_eval_20260924.html）。
     石のある所を押したのは数えない＝指の ずれ（うっかり）を 考えの まちがいと 分けるため。
     場所は ぜったいに 示さない（しげ裁定Q1＝A案）。
     もとの 3回で ルールの絵・6回で「いっしょに さがそう」（判定述語P1）は、この裁定で おきかえた。

     anchorOk＝p が sq に置いたとき、anchor の じぶんの いしで あいての いしを はさめるか。
     sq から anchor へ まっすぐ（たて・よこ・ななめ）で、あいだが ぜんぶ あいての いし＝はさめる */
  OKR.anchorOk = function (b, sq, p, anchor) {
    var opp = p === 1 ? 2 : 1;
    var r0 = Math.floor(sq / 8), c0 = sq % 8, r1 = Math.floor(anchor / 8), c1 = anchor % 8;
    var dr = r1 - r0, dc = c1 - c0, n, sr, sc, i;
    if (b[sq] !== 0 || b[anchor] !== p) { return false; }
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) { return false; }
    n = Math.max(Math.abs(dr), Math.abs(dc));
    if (n < 2) { return false; }   /* となり どうし＝あいだに あいての いしが 無い */
    sr = dr / n; sc = dc / n;
    for (i = 1; i < n; i++) {
      if (b[(r0 + sr * i) * 8 + (c0 + sc * i)] !== opp) { return false; }
    }
    return true;
  };

  /* ================= はじめの 1かいで おけた わりあい（しゅうごと） =================
     学習が 伸びたかを 見る ものさし（評価の正本 第5章）。
     1局ごとの記録（50局まで）とは べつに、しゅうごとの 合計だけを のこす＝何か月でも 追える。
     しゅうの はじめ＝げつようび（端末の じこく） */
  function weekKey(t) {
    var d = new Date(t), back = (d.getDay() + 6) % 7;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  OKR.weekKey = weekKey;
  OKR.MAX_WEEKS = 12;

  /* ft＝はさめない所を1回も押さずに置けた手の数 ／ tn＝置いた手の数 */
  OKR.addFirstTry = function (s, t, ft, tn) {
    var k = String(weekKey(t)), w;
    if (!(tn > 0)) { return; }
    w = s.weeks[k] || { ft: 0, tn: 0 };
    w.ft += ft;
    w.tn += tn;
    s.weeks[k] = w;
  };

  /* 新しい しゅう から MAX_WEEKS ぶん。{ m: 月, d: 日, pct: 0〜100, tn: 手の数 } */
  OKR.weekRows = function (s) {
    var keys = [], k, i, out = [], w, n;
    for (k in s.weeks) { if (s.weeks.hasOwnProperty(k)) { keys.push(parseInt(k, 10)); } }
    keys.sort(function (a, b) { return b - a; });
    for (i = 0; i < keys.length && i < OKR.MAX_WEEKS; i++) {
      w = s.weeks[String(keys[i])];
      n = keys[i];
      out.push({ m: Math.floor(n / 100) % 100, d: n % 100,
                 pct: Math.round(w.ft * 100 / w.tn), tn: w.tn });
    }
    return out;
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = OKR; }
