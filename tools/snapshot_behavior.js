/* つよくなるオセロ ── 「作り替える前と後で動きが1ミリも変わっていない」を機械で見るための道具
   2026-09-21 工程2。

   なぜ要るか＝工程2では ai.js と blunder.js を「途中で止められる形」に作り替える。
   作り替えで打ち手や採点が変わると、工程1で測った梯子の強さも悪手の判定も嘘になる。
   そこで、作り替える前に「決まった種で戦わせた結果」と「その棋譜の採点結果」を写し取り、
   作り替えた後にもう一度走らせて、1文字でも違えば落ちるようにする。

   使い方＝
     jsc snapshot_behavior.js > tools/behavior_before.json
     （作り替えたあと） jsc snapshot_behavior.js > tools/behavior_after.json
     python3 tools/diff_behavior.py tools/behavior_before.json tools/behavior_after.json
*/

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');

/* 見る組み合わせ＝梯子の両方の帯・つなぎ目・子ども代理・段どうし */
var PAIRS = [
  ['L1', 'L2'], ['L4', 'L5'], ['L7', 'L8'], ['L8', 'L9'],
  ['L9', 'L10'], ['L12', 'L13'], ['L16', 'L17'], ['L19', 'L20'],
  ['L3', 'Pgreedy'], ['L10', 'Pgreedy'], ['L20', 'PgreedyCorner'],
  ['Pgreedy', 'L5'], ['PgreedyCorner', 'L14']
];
var GAMES_PER_PAIR = 6;
var OPENING = 4;

function parseSpec(s) {
  if (s.charAt(0) === 'L') { return { type: 'level', level: parseInt(s.slice(1), 10) }; }
  return { type: 'proxy', key: s.slice(1) };
}

/* 棋譜をそのまま文字にする（1手でも違えば文字列が変わる） */
function movesToStr(moves) {
  var out = [], i;
  for (i = 0; i < moves.length; i++) { out.push(moves[i].player + ':' + moves[i].sq); }
  return out.join(',');
}

var rows = [], pi, gi, spec, r, seed, judged, res, w, k;

for (pi = 0; pi < PAIRS.length; pi++) {
  for (gi = 0; gi < GAMES_PER_PAIR; gi++) {
    seed = (pi + 1) * 1000003 + gi * 7919 + 1;
    r = OKAI.playGame(parseSpec(PAIRS[pi][0]), parseSpec(PAIRS[pi][1]), seed, OPENING);
    judged = [];
    for (k = 1; k <= 2; k++) {
      res = OKB.judge(r.moves, k);
      w = res.worst;
      judged.push({
        color: k,
        n: res.blunders.length,
        worst: w ? { ply: w.ply, sq: w.sq, loss: w.loss, phase: w.phase, type: w.type.key } : null,
        cappedAt: OKB.lastCappedAt,
        cost: { mid: OKB.lastCost.mid, end: OKB.lastCost.end }
      });
    }
    rows.push({
      pair: PAIRS[pi][0] + ' vs ' + PAIRS[pi][1], seed: seed,
      winner: r.winner, black: r.blackDiscs, white: r.whiteDiscs,
      plies: r.moves.length, moves: movesToStr(r.moves),
      judge: judged
    });
  }
}

print(JSON.stringify({ pairs: PAIRS.length, games: rows.length, rows: rows }, null, 1));
