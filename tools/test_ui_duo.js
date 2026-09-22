/* つよくなるオセロ ── 「ふたりで あそぶ」の試験（jsc・擬似の画面つき）
   2026-09-22 しげ指示で追加した あそびかた を、機械で1局ぶん通す。

   なぜ擬似の画面が要るか＝
     ui.js は これまで機械の試験が1本も無く、工程3では査読役がその場で作った画面代用で
     見ただけだった。ふたりの あそびかた は ui.js の中だけで完結するので、
     ここに試験を置かないと「動くはず」しか言えない。

   ここで確かめること＝
     ①はじめの がめん が最初に出る
     ②「ふたりで あそぶ」で たいきょく が始まり、S.duo が立つ
     ③どちらの色の手番でも 人の タップ が通る（相手の読みが1回も走らない）
     ④手番が くろ→しろ→くろ… と 入れかわる
     ⑤終わったら 色で 勝ちが出る
     ⑥**記録が1文字も増えない**（ふたりで かっても れべるが ひらかない）
     ⑦「ひとりで あそぶ」は ちず へ進む（これまでどおり）

   走らせ方 ＝
     /System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc tools/test_ui_duo.js
*/

/* ================= 擬似の画面 ================= */
var TIMERS = [];
function setTimeout(fn, ms) {                    /* eslint-disable-line no-unused-vars */
  TIMERS.push({ fn: fn, at: (ms || 0) });
  return TIMERS.length;
}
function clearTimeout(id) {
  if (id >= 1 && id <= TIMERS.length) { TIMERS[id - 1] = null; }
}
function setInterval() { return 0; }
/* たまった待ちを 早送りで 全部こなす（時刻は進めない＝順番だけ守る） */
function pumpTimers(kai) {
  var n = 0, i, list;
  while (TIMERS.length > 0 && n < (kai || 100000)) {
    list = TIMERS;
    TIMERS = [];
    for (i = 0; i < list.length; i++) {
      if (list[i]) { list[i].fn(); n++; }
    }
  }
  return n;
}

function Node(tag) {
  this.tagName = tag;
  this.className = '';
  this.style = {};
  this.childNodes = [];
  this.firstChild = null;
  this.attrs = {};
  this.value = '';
  this.offsetWidth = 100;
  this.clientWidth = 900;
  this.clientHeight = 700;
}
Node.prototype.appendChild = function (c) {
  this.childNodes.push(c);
  this.firstChild = this.childNodes[0];
  return c;
};
Node.prototype.removeChild = function (c) {
  var i, out = [];
  for (i = 0; i < this.childNodes.length; i++) {
    if (this.childNodes[i] !== c) { out.push(this.childNodes[i]); }
  }
  this.childNodes = out;
  this.firstChild = out.length ? out[0] : null;
  return c;
};
Node.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
Node.prototype.getAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
};
Node.prototype.text = function () {
  var i, s = '';
  for (i = 0; i < this.childNodes.length; i++) {
    s += (this.childNodes[i].nodeValue !== undefined)
      ? this.childNodes[i].nodeValue : this.childNodes[i].text();
  }
  return s;
};

var NODES = {};
var document = {                                 /* eslint-disable-line no-unused-vars */
  documentElement: new Node('html'),
  createElement: function (t) { return new Node(t); },
  createTextNode: function (s) { return { nodeValue: String(s) }; },
  getElementById: function (id) {
    if (!NODES[id]) { NODES[id] = new Node('div'); }
    return NODES[id];
  },
  elementFromPoint: function () { return null; }
};

var STORE = {};
var window = {                                   /* eslint-disable-line no-unused-vars */
  innerWidth: 1024,
  innerHeight: 768,
  scrollTo: function () {},
  localStorage: {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(STORE, k) ? STORE[k] : null;
    },
    setItem: function (k, v) { STORE[k] = String(v); },
    removeItem: function (k) { delete STORE[k]; }
  }
  /* AudioContext も XMLHttpRequest も history も置かない＝
     どれも「無ければ静かに あきらめる」書き方になっていることを ここで一緒に確かめる */
};
var sessionStorage = null;                       /* eslint-disable-line no-unused-vars */

/* ================= 中身を読みこむ ================= */
load('tools/core.js');
load('tools/ai.js');
load('tools/blunder.js');
load('tools/rules.js');
load('tools/text.js');
load('tools/ui.js');

var BLACK = 1, WHITE = 2;
var ok = 0, ng = 0;
function is(nani, mita, kitai) {
  var a = JSON.stringify(mita), b = JSON.stringify(kitai);
  if (a === b) { print('OK  ' + nani); ok++; }
  else { print('NG  ' + nani + '  みた=' + a + '  きたい=' + b); ng++; }
}
function isTrue(nani, mita) { is(nani, !!mita, true); }

/* 相手の読みが1回でも走ったら 分かるようにしておく */
var aiKaisu = 0;
var honmono = OKAI.makeChooser;
OKAI.makeChooser = function (a, b, c, d) { aiKaisu++; return honmono(a, b, c, d); };

/* ================= ここから試験 ================= */
OKUI.start();
pumpTimers();
var S = OKUI.state;

is('①はじめの がめん が最初に出る', S.screen, 'mode');
is('　　えらぶ ボタンの ことば（ひとり）', NODES['mode-solo'].text(), OKT.mode.solo);
is('　　えらぶ ボタンの ことば（ふたり）', NODES['mode-duo'].text(), OKT.mode.duo);

/* ---- ⑦「ひとりで あそぶ」＝ちずへ ---- */
NODES['mode-solo'].onclick();
is('⑦ひとりで あそぶ→ちず', S.screen, 'map');
isTrue('　　ひとりの ときは duo が立たない', S.duo === false);

/* ---- ②「ふたりで あそぶ」＝たいきょくへ ---- */
NODES['mode-back'] = NODES['mode-back'] || new Node('div');
NODES['map-back'].onclick();
is('　　ちずから はじめの がめん へ もどれる', S.screen, 'mode');

aiKaisu = 0;
NODES['mode-duo'].onclick();
pumpTimers();
is('②ふたりで あそぶ→たいきょく', S.screen, 'game');
isTrue('　　duo が立つ', S.duo === true);
is('　　さきばんは くろ', S.player, BLACK);
is('　　手番の しらせ', NODES.turn.text(), OKT.game.black + OKT.game.turnSuffix);

/* ---- ③④ 1局ぶん、どちらの色も 人が押して 打ちきる ---- */
var junban = [], te = 0, maeNo = -1;
while (S.screen === 'game' && te < 200) {
  var ima = S.player;
  var teList = OK.legalMoves(S.board, ima);
  if (teList.length === 0) { pumpTimers(); continue; }   /* パスの待ちを こなす */
  junban.push(ima);
  OKUI.tapCell(teList[0]);
  pumpTimers();
  te++;
}
isTrue('③相手の読みは1回も走らない', aiKaisu === 0);
isTrue('④くろも しろも 打てた', junban.indexOf(BLACK) >= 0 && junban.indexOf(WHITE) >= 0);
isTrue('　　1局が おわった', S.screen === 'result');
isTrue('　　打った手が 60手ちかくある', S.moves.length >= 50);

/* ---- ⑤ 色で 勝ちが出る ---- */
var atama = NODES['res-head'].text();
var nb = S.result.nb, nw = S.result.nw;
var kitaiAtama = nb === nw ? OKT.result.draw
  : ((nb > nw ? OKT.game.black : OKT.game.white) + OKT.result.winSuffix);
is('⑤けっかの見出しは 色で出る', atama, kitaiAtama);
is('　　もどる ボタンの ことば', NODES['res-back'].text(), OKT.result.backDuo);
is('　　ほめる文は 出さない', NODES['res-praise'].text(), '');

/* ---- ⑥ 記録が1文字も増えていない ---- */
is('⑥端末の保存が からのまま', STORE, {});
is('　　きろくの 対局数が 0', S.save.games.length, 0);
is('　　ひらいた れべるの数が 1（れべる1だけ）', OKR.openCount(S.save), 1);

/* ---- もどる → もういちど ---- */
NODES['res-back'].onclick();
is('　　ふたりの あとは はじめの がめん へ もどる', S.screen, 'mode');

/* ================= ⑧ ひとりで あそぶ が こわれていないか ================= */
aiKaisu = 0;
OKUI.startGame(1, BLACK, false);
pumpTimers();
isTrue('⑧ひとりの ときは duo が下りる', S.duo === false);
te = 0;
while (S.screen === 'game' && te < 200) {
  var jibun = OK.legalMoves(S.board, S.childColor);
  if (S.player !== S.childColor || S.busy || jibun.length === 0) {
    if (pumpTimers(1) === 0) { break; }
    continue;
  }
  OKUI.tapCell(jibun[0]);
  pumpTimers();
  te++;
}
isTrue('　　相手の読みが走った', aiKaisu > 0);
isTrue('　　1局が おわった', S.screen === 'result');
is('　　きろくに 1局 のこる', S.save.games.length, 1);
isTrue('　　端末に 保存された', STORE[OKR.KEY] !== undefined);

print('');
print('とおった = ' + ok + ' / ' + (ok + ng));
print('ふたりで あそぶ の試験 = ' + (ng === 0 ? 'PASS' : 'FAIL'));
if (ng > 0) { throw new Error('FAIL'); }
