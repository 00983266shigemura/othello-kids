/* つよくなるオセロ ── 記録ときまりの試験（工程2・判定述語P2とP1の道すじ）
   使い方＝ jsc test_rules.js
   ここで見るもの＝
     ①レベルは「くろで勝ち」かつ「しろで勝ち」でだけ次が開く（P2）
     ②はさめない所を押した回数と、出る助けの段階（P1の道すじ）
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
ok(OKR.FOUL_LIMIT === 3, 'イエローカードは 3まいで まけ');
ok(OKR.foulLeft(1) === 2, '1まい＝あと2かい');
ok(OKR.foulLeft(2) === 1, '2まい＝あと1かい');
ok(OKR.foulLeft(3) === 0, '3まい＝もう まけ');
ok(OKR.foulLeft(9) === 0, 'なんまい でも 0より 下がらない');

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
