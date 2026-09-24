/* つよくなるオセロ ── 記録ときまりの試験（工程2・判定述語P2とP1の道すじ）
   使い方＝ jsc test_rules.js
   ここで見るもの＝
     ①レベルは「くろで勝ち」かつ「しろで勝ち」でだけ次が開く（P2）
     ②たしかめ（はさむ じぶんの いし）の判定と、はじめの1かいで おけた わりあい
     ③端末内の保存は othelloKids_ で始まる鍵だけを触り、全消去をしない
     ④できたこと スタンプの数えかた
   画面（ui.js）は DOM が要るので ここでは見ない＝画面はブラウザで動かして確かめる。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'rules.js');
load(HERE + 'text.js');

var ng = 0, n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { ng++; print('NG  ' + name); }
  else { print('OK  ' + name); }
}

/* にせの 端末内保存（localStorage のかわり）。clear を呼ばれたら 分かるようにしておく */
function FakeStore() {
  this.data = {};
  this.cleared = 0;
}
FakeStore.prototype.getItem = function (k) {
  return this.data.hasOwnProperty(k) ? this.data[k] : null;
};
FakeStore.prototype.setItem = function (k, v) { this.data[k] = String(v); };
FakeStore.prototype.removeItem = function (k) { delete this.data[k]; };
FakeStore.prototype.clear = function () { this.cleared++; this.data = {}; };

/* ---- ① レベルの開きかた（P2） ---- */
var s = OKR.newSave();
ok(OKR.isOpen(s, 1), '1だんめは さいしょから あそべる');
ok(!OKR.isOpen(s, 2), '2だんめは さいしょは 閉じている');

var opened = OKR.markWin(s, 1, OK.BLACK);
ok(opened === 0, 'くろで1勝しただけでは つぎは 開かない');
ok(!OKR.isOpen(s, 2), 'くろだけでは 2だんめは まだ 閉じている');

opened = OKR.markWin(s, 1, OK.WHITE);
ok(opened === 2, 'しろでも勝つと つぎ（2だんめ）が 開く');
ok(OKR.isOpen(s, 2), '2だんめが 開いている');
ok(!OKR.isOpen(s, 3), '3だんめは まだ 閉じている');

opened = OKR.markWin(s, 1, OK.BLACK);
ok(opened === 0, '同じ色で もう1回勝っても 何も 開かない');

/* 20段まで ぜんぶ 開けられるか */
var t = OKR.newSave(), i, last = 0;
for (i = 1; i <= OKR.LEVELS; i++) {
  OKR.markWin(t, i, OK.BLACK);
  last = OKR.markWin(t, i, OK.WHITE);
}
ok(OKR.openCount(t) === 20, '20だん すべてを 開けられる');
ok(last === 0, '20だんめを クリアしても 21だんめは 生えない');
ok(OKAI.LADDER.length === 20, '梯子は 20段 ある');

/* おうちのひとの「すべて ひらく」 */
var u = OKR.newSave();
u.openAll = true;
ok(OKR.openCount(u) === 20, 'おうちのひとが ひらけば ぜんぶ あそべる');

/* ---- ② 置けない所を 押したときの 段階（P1の道すじ） ---- */
/* ---- たしかめ＝「はさむ じぶんの いし」の判定（しげ裁定「Cで」） ----
   でたらめに打ち合った局面で、anchorOk を 本物の 打ち手（applyMove が返す 返った石）と 突き合わせる。
   ①置ける所には 正しい いしが 1つ以上ある ②正しい いしと 置く所の あいだは ぜんぶ 返る
   ③正しい いしの数＝石が返る 向きの数 ④置けない所には 正しい いしが 1つも無い */
(function () {
  var seed = 7, bad = 0, checked = 0, g, ply, b, p, legal, sq, a, f, set, i, ok1, dirs, anchors;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function between(s, t) {
    var r0 = Math.floor(s / 8), c0 = s % 8, dr = Math.floor(t / 8) - r0, dc = t % 8 - c0;
    var n = Math.max(Math.abs(dr), Math.abs(dc)), out = [], k;
    for (k = 1; k < n; k++) { out.push((r0 + dr / n * k) * 8 + (c0 + dc / n * k)); }
    return out;
  }
  function dirCount(bb, s, pp, flips) {   /* 返った石が 何本の 向きに あるか */
    var seen = {}, cnt = 0, j, r, c, dr, dc, key;
    for (j = 0; j < flips.length; j++) {
      r = Math.floor(flips[j] / 8) - Math.floor(s / 8); c = flips[j] % 8 - s % 8;
      dr = r === 0 ? 0 : r / Math.abs(r); dc = c === 0 ? 0 : c / Math.abs(c);
      key = dr + ',' + dc;
      if (!seen[key]) { seen[key] = true; cnt++; }
    }
    return cnt;
  }
  for (g = 0; g < 40; g++) {
    b = OK.initBoard(); p = 1;
    for (ply = 0; ply < 60; ply++) {
      legal = OK.legalMoves(b, p);
      if (legal.length === 0) { p = OK.other(p); if (OK.legalMoves(b, p).length === 0) { break; } continue; }
      for (sq = 0; sq < 64; sq++) {
        if (b[sq] !== 0) { continue; }
        anchors = [];
        for (a = 0; a < 64; a++) { if (OKR.anchorOk(b, sq, p, a)) { anchors.push(a); } }
        checked++;
        if (legal.indexOf(sq) < 0) { if (anchors.length !== 0) { bad++; } continue; }
        f = OK.copyBoard(b);
        set = {};
        var fl = OK.applyMove(f, sq, p);
        for (i = 0; i < fl.length; i++) { set[fl[i]] = true; }
        dirs = dirCount(b, sq, p, fl);
        ok1 = anchors.length === dirs && anchors.length >= 1;
        for (i = 0; i < anchors.length && ok1; i++) {
          var bw = between(sq, anchors[i]), j2;
          for (j2 = 0; j2 < bw.length; j2++) { if (!set[bw[j2]]) { ok1 = false; } }
        }
        if (!ok1) { bad++; }
      }
      OK.applyMove(b, legal[Math.floor(rnd() * legal.length)], p);
      p = OK.other(p);
    }
  }
  ok(bad === 0 && checked > 1000, 'たしかめの判定が 本物の 打ち手と 一致（' + checked + 'マス・ずれ ' + bad + '）');
})();
(function () {
  var b = OK.initBoard(), i, own = -1;
  for (i = 0; i < 64; i++) { if (b[i] === 1) { own = i; break; } }
  ok(!OKR.anchorOk(b, own, 1, own), '石のある所には おけない（たしかめでも）');
  ok(!OKR.anchorOk(b, 0, 1, 63), 'はなれた ななめ でも あいだが あいての いしで なければ ×');
})();

/* ---- はじめの 1かいで おけた わりあい（しゅうごと） ---- */
ok(OKR.weekKey(new Date(2026, 8, 24, 12).getTime()) === 20260921, 'もくようび→ その しゅうの げつようび');
ok(OKR.weekKey(new Date(2026, 8, 27, 23).getTime()) === 20260921, 'にちようびは まえの げつようびの しゅう');
ok(OKR.weekKey(new Date(2026, 8, 28, 0).getTime()) === 20260928, 'げつようびは あたらしい しゅう');
ok(OKR.weekKey(new Date(2026, 9, 1, 9).getTime()) === 20260928, 'つきを またいでも おなじ しゅう');
(function () {
  var s = OKR.newSave(), rows;
  OKR.addFirstTry(s, new Date(2026, 8, 22, 10).getTime(), 10, 20);
  OKR.addFirstTry(s, new Date(2026, 8, 24, 10).getTime(), 5, 10);
  OKR.addFirstTry(s, new Date(2026, 8, 29, 10).getTime(), 9, 10);
  OKR.addFirstTry(s, new Date(2026, 8, 30, 10).getTime(), 0, 0);   /* 0手の局は のこさない */
  rows = OKR.weekRows(s);
  ok(rows.length === 2, 'しゅうは 2つ');
  ok(rows[0].m === 9 && rows[0].d === 28 && rows[0].pct === 90 && rows[0].tn === 10, 'あたらしい しゅうが うえ（90%・10て）');
  ok(rows[1].m === 9 && rows[1].d === 21 && rows[1].pct === 50 && rows[1].tn === 30, 'おなじ しゅうは たしあわせる（15/30＝50%）');
  var back = OKR.normalize(JSON.parse(JSON.stringify(s)));
  ok(back.weeks['20260921'].tn === 30, '保存して 読みなおしても のこる');
  ok(JSON.stringify(OKR.normalize({ weeks: { x: { ft: 1, tn: 0 }, y: 'z' } }).weeks) === '{}', 'こわれた しゅうの 記録は すてる');
  ok(JSON.stringify(OKR.normalize({}).weeks) === '{}', '古い 記録（weeks が無い）でも 落ちない');
})();

/* ---- ③ 端末内の保存 ---- */
var st = new FakeStore();
st.setItem('okaeriQuest_stamp', 'たいせつな きろく');   /* よその アプリの 記録 */
var v = OKR.newSave();
v.sound = false;
OKR.markWin(v, 1, OK.BLACK);
ok(OKR.save(st, v), 'ほぞん できる');
var w = OKR.load(st);
ok(w.sound === false && OKR.wonWith(w, 1, OK.BLACK), 'ほぞんした中身が そのまま よみ出せる');

var after = OKR.wipe(st);
ok(st.cleared === 0, 'やりなおしで 全消去（clear）を 呼んでいない');
ok(st.getItem('okaeriQuest_stamp') === 'たいせつな きろく', 'よその アプリの 記録は のこっている');
ok(st.getItem(OKR.KEY) === null, '自分の 記録だけ 消えている');
ok(OKR.openCount(after) === 1, 'やりなおすと 1だんめだけに もどる');

var i2;
for (i2 = 0; i2 < OKR.KEYS.length; i2++) {
  ok(OKR.KEYS[i2].indexOf('othelloKids_') === 0, '使う鍵は othelloKids_ で はじまる: ' + OKR.KEYS[i2]);
}

/* こわれた中身でも 落ちない */
st.setItem(OKR.KEY, '{こわれている');
ok(OKR.openCount(OKR.load(st)) === 1, 'こわれた記録を よんでも まっさらに もどるだけ');

/* 保存できない端末（私的ブラウズなど）でも 落ちない */
var dead = { getItem: function () { throw new Error('no'); },
             setItem: function () { throw new Error('no'); },
             removeItem: function () { throw new Error('no'); } };
ok(OKR.openCount(OKR.load(dead)) === 1, 'よみ出せない端末でも あそべる形で 返る');
ok(OKR.save(dead, OKR.newSave()) === false, 'かけない端末では false を 返す（落ちない）');

/* ---- ④ できたこと スタンプ ---- */
var moves = [
  { sq: 19, player: OK.BLACK },   /* ふつうの手 */
  { sq: 26, player: OK.WHITE },
  { sq: 0, player: OK.BLACK },    /* かど a1 */
  { sq: 3, player: OK.BLACK }     /* 2回つづけて 自分の手＝あいてが パスした */
];
var got = OKR.stampsOf(moves, OK.BLACK);
function has(a, k) { var j; for (j = 0; j < a.length; j++) { if (a[j] === k) { return true; } } return false; }
ok(has(got, 'corner'), 'かどを とった が つく');
ok(has(got, 'edge'), 'はしを つかった が つく（3ばんめの マス）');
ok(has(got, 'pass'), 'パスさせた が つく');
ok(has(got, 'last'), 'さいごまで うった が つく');

var got2 = OKR.stampsOf([{ sq: 19, player: OK.BLACK }, { sq: 26, player: OK.WHITE }], OK.BLACK);
ok(!has(got2, 'corner') && !has(got2, 'pass'), 'していないことには スタンプが つかない');

var z = OKR.newSave();
OKR.addStamps(z, got);
OKR.addStamps(z, got);
ok(z.stamps.corner === 2, 'スタンプは かさなって ふえる');

/* ---- ⑤ 対局の記録は 50局まで ---- */
var g = OKR.newSave(), k;
for (k = 0; k < 60; k++) { OKR.addGame(g, { t: k, lv: 1, color: 'b', res: 'l', mine: 20, theirs: 44, reason: 'noCorner' }); }
ok(g.games.length === 50, '記録は 50局で 止まる');
ok(g.games[0].t === 59, 'あたらしい ものが さき に 来る');
ok(OKR.reasonCounts(g).noCorner === 50, 'まけた わけの かいすうが 数えられる');

/* ---- ⑥ ことばの 表に 抜けが ないか ---- */
var need = ['noCorner', 'nextToCorner', 'nextToCornerSafe', 'gaveCorner',
            'lostMobility', 'tookTooMany', 'endCount', 'none'];
var m;
for (m = 0; m < need.length; m++) {
  ok(!!OKT.grown.voice[need[m]], 'おうちのひとへの こえかけが ある: ' + need[m]);
}
for (m = 0; m < OKR.STAMPS.length; m++) {
  ok(!!OKT.result.praise[OKR.STAMPS[m].key],
    'スタンプごとの ほめことばが ある: ' + OKR.STAMPS[m].key);
}

print('');
print('とおった = ' + (n - ng) + ' / ' + n);
print('記録ときまりの試験 = ' + (ng === 0 ? 'PASS' : 'FAIL'));
