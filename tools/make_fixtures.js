/* つよくなるオセロ ── 悪手判定器の試験用の棋譜をさがす台本（工程1・P4の材料作り）
   使い方＝ jsc make_fixtures.js -- max=2 games=60
   やること＝子ども代理の対局を作り、いちばん損の大きい悪手の「型」ごとに候補を拾う。
   出す物＝人が読む盤の絵と、凍結用の JSON 行（JSON= で始まる行）。
   期待する理由は「人が絵を見て」決める＝判定器の出力をそのまま正解にしない。 */

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
var maxPer = parseInt(A.max || '2', 10);
var nGames = parseInt(A.games || '60', 10);
/* want=gaveCorner,NOBLUNDER ＝ その型だけをさがす（空なら全部） */
var WANT = (A.want || '') ? String(A.want).split(',') : null;
function wanted(k) {
  if (!WANT) { return true; }
  var i;
  for (i = 0; i < WANT.length; i++) { if (WANT[i] === k) { return true; } }
  return false;
}
/* childCfg=strong ＝ 子の役を「じょうずな打ちて」にする（悪手なしの例を作るため） */
var STRONG_CHILD = (A.childCfg === 'strong');
var SEED_BASE = parseInt(A.seedBase || '314159', 10);

function sqName(sq) {
  return 'abcdefgh'.charAt(sq & 7) + String((sq >> 3) + 1);
}

function drawBoard(b, markSq, markCorner) {
  var lines = ['   a b c d e f g h'], r, c, i, row, ch;
  for (r = 0; r < 8; r++) {
    row = ' ' + String(r + 1) + ' ';
    for (c = 0; c < 8; c++) {
      i = r * 8 + c;
      ch = b[i] === OK.BLACK ? '#' : (b[i] === OK.WHITE ? 'O' : '.');
      if (i === markSq) { ch = '!'; }
      else if (i === markCorner) { ch = '*'; }
      row += ch + ' ';
    }
    lines.push(row);
  }
  return lines.join('\n');
}

/* 人が理由を決めるための「事実」＝core.js の基本の関数だけで出す。
   blunder.js の型付けの関数（nameType）は一切使わない＝期待する理由を人が独立に決めるため。 */
var CNR = [0, 7, 56, 63];
var NEAR = { 1: 0, 8: 0, 9: 0, 6: 7, 15: 7, 14: 7, 48: 56, 57: 56, 49: 56, 55: 63, 62: 63, 54: 63 };

function cornersLegal(b, p) {
  var out = [], i;
  for (i = 0; i < 4; i++) { if (OK.countFlips(b, CNR[i], p) > 0) { out.push(sqName(CNR[i])); } }
  return out;
}

function facts(w, moves, childColor) {
  var b0 = w.boardBefore, p = childColor, opp = OK.other(p);
  var b1 = OK.copyBoard(b0);
  OK.applyMove(b1, w.sq, p);
  var near = NEAR[w.sq];
  var oppCornerNow = cornersLegal(b1, opp);
  var oppCornerBefore = cornersLegal(b0, opp);
  /* 相手が1手返した時点で、自分に残る置ける場所の数 */
  var b2 = OK.copyBoard(b1), k, myLeft = -1;
  for (k = w.ply + 1; k < moves.length; k++) {
    if (moves[k].player === opp) { OK.applyMove(b2, moves[k].sq, opp); }
    myLeft = OK.legalMoves(b2, p).length;
    break;
  }
  /* その後4手以内に相手がかどを取ったか */
  var took = '-';
  for (k = w.ply + 1; k < moves.length && k <= w.ply + 4; k++) {
    if (moves[k].player === opp && (moves[k].sq === 0 || moves[k].sq === 7
        || moves[k].sq === 56 || moves[k].sq === 63)) { took = sqName(moves[k].sq); break; }
  }
  return 'じぶんが取れたかど=[' + cornersLegal(b0, p).join(' ') + ']'
    + ' / うったマスはかどの となりか=' + (near === undefined ? 'いいえ'
        : (sqName(near) + 'の となり・そのかどは' + (b0[near] === OK.EMPTY ? 'あき' : 'もう うまってる')))
    + ' / あいてに開いたかど=[' + oppCornerBefore.join(' ') + ']→[' + oppCornerNow.join(' ') + ']'
    + ' / 4手いないに あいてが取ったかど=' + took
    + ' / あいてが1手返した時 自分に残る手=' + myLeft
    + ' / 手数=' + w.ply + ' / ひっくり返し=' + w.flips + ' / 場面=' + w.phase;
}

var CHILDREN = ['greedy', 'greedyCorner'];
/* 相手の設定＝梯子の段番号に頼らない書き方（梯子を組み替えても同じ材料が出る） */
var OPPS = [
  { kind: 'random', bad: 0 },
  { kind: 'search', depth: 1, eps: 0.3 },
  { kind: 'search', depth: 2, eps: 0 },
  { kind: 'search', depth: 4, eps: 0 },
  { kind: 'search', depth: 6, eps: 0, endEmpties: 12 }
];

var found = {}, total = 0, gi, ci, li, childColor, r, res, key, d, seed;

outer:
for (gi = 0; gi < nGames; gi++) {
  for (ci = 0; ci < CHILDREN.length; ci++) {
    for (li = 0; li < OPPS.length; li++) {
      childColor = (gi % 2 === 0) ? OK.BLACK : OK.WHITE;
      var childSpec = STRONG_CHILD
        ? { type: 'cfg', cfg: { kind: 'search', depth: 6, eps: 0, endEmpties: 12 } }
        : { type: 'proxy', key: CHILDREN[ci] };
      var oppSpec = { type: 'cfg', cfg: OPPS[li] };
      seed = SEED_BASE + gi * 7919 + ci * 131 + li * 17;
      r = OKAI.playGame(
        childColor === OK.BLACK ? childSpec : oppSpec,
        childColor === OK.BLACK ? oppSpec : childSpec,
        seed, 4);
      res = OKB.judge(r.moves, childColor);
      key = res.worst ? res.worst.type.key : 'NOBLUNDER';
      if (!wanted(key)) { continue; }
      if (!found[key]) { found[key] = 0; }
      if (found[key] >= maxPer) { continue; }
      found[key]++;
      total++;

      d = OKB.describe(res);
      print('=========================================================');
      print('判定器の型 = ' + key + '（' + (res.worst ? res.worst.type.name : 'なし') + '）');
      print('こども = ' + CHILDREN[ci] + ' / 色 = '
        + (childColor === OK.BLACK ? 'くろ #' : 'しろ O')
        + ' / あいて = ' + JSON.stringify(OPPS[li]) + ' / seed = ' + seed);
      if (res.worst) {
        print('手数 ply=' + res.worst.ply + '  うったマス=' + sqName(res.worst.sq)
          + '  そん=' + res.worst.loss + '(' + res.worst.phase + ')'
          + '  そのとき おけた手=' + res.worst.legalCount
          + '  ひっくり返した数=' + res.worst.flips
          + '  あき=' + (64 - OK.discCount(res.worst.boardBefore))
          + '  この局の悪手=' + res.blunders.length + '個');
        print('! = こどもが うったところ   * = そのあと あいてが とった かど');
        print(drawBoard(res.worst.boardBefore, res.worst.sq, res.worst.oppCorner));
        /* そのあと実際にどう進んだか（4手ぶん）＝人が理由を確かめるため */
        var nx = [], k;
        for (k = res.worst.ply + 1; k < r.moves.length && k <= res.worst.ply + 4; k++) {
          nx.push((r.moves[k].player === OK.BLACK ? '#' : 'O') + sqName(r.moves[k].sq));
        }
        print('このあとの4手 = ' + nx.join(' '));
        print('事実 = ' + facts(res.worst, r.moves, childColor));
        print('文 = 「' + d.why + '」／「' + d.next + '」');
      } else {
        print('悪手なし → 「' + OKB.NO_BLUNDER_TEXT + '」');
      }
      print('JSON=' + JSON.stringify({
        judged: key,
        childColor: childColor,
        child: CHILDREN[ci],
        opp: OPPS[li],
        seed: seed,
        ply: res.worst ? res.worst.ply : -1,
        sq: res.worst ? res.worst.sq : -1,
        loss: res.worst ? res.worst.loss : 0,
        phase: res.worst ? res.worst.phase : '',
        moves: r.moves
      }));
      if (total >= 30) { break outer; }
    }
  }
}
print('\n見つかった型 = ' + JSON.stringify(found));
