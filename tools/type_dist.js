/* つよくなるオセロ ── 悪手の「型」がどれくらいの割合で出るかを測る（工程1）
   使い方＝ jsc type_dist.js -- games=40 seed=11
   ねらい＝設計書4.5章の6つの型のうち、実戦でほとんど出ない型がないかを見る。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');

function parseArgs(argv) {
  var out = {}, i, kv;
  for (i = 0; i < argv.length; i++) {
    kv = String(argv[i]).split('=');
    out[kv[0]] = kv.length > 1 ? kv.slice(1).join('=') : '1';
  }
  return out;
}
var A = parseArgs(typeof arguments !== 'undefined' ? arguments : []);
var nGames = parseInt(A.games || '40', 10);
var seed0 = parseInt(A.seed || '11', 10);
if (A.mid || A.end) {
  OKB.setThresholds(A.mid ? parseFloat(A.mid) : undefined,
                    A.end ? parseFloat(A.end) : undefined);
}

var CHILDREN = ['greedy', 'greedyCorner'];
var OPPS = [
  { kind: 'random', bad: 0 },
  { kind: 'search', depth: 1, eps: 0.3 },
  { kind: 'search', depth: 2, eps: 0 }
];

var count = {}, nBlunders = 0, nGamesDone = 0, allTypes = 0;
var gi, ci, li, childColor, r, res, key, i;

for (gi = 0; gi < nGames; gi++) {
  for (ci = 0; ci < CHILDREN.length; ci++) {
    for (li = 0; li < OPPS.length; li++) {
      childColor = (gi % 2 === 0) ? OK.BLACK : OK.WHITE;
      var childSpec = { type: 'proxy', key: CHILDREN[ci] };
      var oppSpec = { type: 'cfg', cfg: OPPS[li] };
      r = OKAI.playGame(
        childColor === OK.BLACK ? childSpec : oppSpec,
        childColor === OK.BLACK ? oppSpec : childSpec,
        seed0 * 1000003 + gi * 7919 + ci * 131 + li * 17, 4);
      res = OKB.judge(r.moves, childColor);
      key = res.worst ? res.worst.type.key : 'NOBLUNDER';
      count[key] = (count[key] || 0) + 1;
      nBlunders += res.blunders.length;
      nGamesDone++;
      /* いちばん損の大きい手だけでなく、悪手ぜんぶの型も数える */
      for (i = 0; i < res.blunders.length; i++) { allTypes++; }
    }
  }
}

var keys = ['noCorner', 'nextToCorner', 'gaveCorner', 'endCount',
            'lostMobility', 'tookTooMany', 'none', 'NOBLUNDER'], k, line = [];
for (i = 0; i < keys.length; i++) {
  k = keys[i];
  line.push(k + '=' + (count[k] || 0)
    + '(' + Math.round(1000 * (count[k] || 0) / nGamesDone) / 10 + '%)');
}
print('局数 = ' + nGamesDone + ' / 1局あたりの悪手 = '
  + Math.round(10 * nBlunders / nGamesDone) / 10);
print('いちばん損の大きい1手の型 = ' + line.join('  '));
