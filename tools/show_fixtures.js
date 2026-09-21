/* つよくなるオセロ ── 凍結した棋譜13本を、いまの判定器の設定で見直すための表示（工程1）
   使い方＝ jsc show_fixtures.js
   出す物＝1本ずつ、いちばん損の大きい手の盤の絵と、理由を決めるための「事実」。
   事実はオセロの基本の関数だけで出す＝判定器の型づけの関数は使わない。
   これを人が読んで、期待する理由を決め直す。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');

var data = JSON.parse(readFile(HERE + 'fixtures_p4.json'));

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
  var near = NEAR[w.sq], k;
  var b2 = OK.copyBoard(b1), myLeft = -1;
  for (k = w.ply + 1; k < moves.length; k++) {
    if (moves[k].player === opp) { OK.applyMove(b2, moves[k].sq, opp); }
    myLeft = OK.legalMoves(b2, p).length;
    break;
  }
  var took = '-';
  for (k = w.ply + 1; k < moves.length && k <= w.ply + 4; k++) {
    if (moves[k].player === opp && (moves[k].sq === 0 || moves[k].sq === 7
        || moves[k].sq === 56 || moves[k].sq === 63)) { took = sqName(moves[k].sq); break; }
  }
  return 'じぶんが取れたかど=[' + cornersLegal(b0, p).join(' ') + ']'
    + ' / うったマスはかどの となりか=' + (near === undefined ? 'いいえ'
        : (sqName(near) + 'の となり・そのかどは' + (b0[near] === OK.EMPTY ? 'あき' : 'もう うまってる')))
    + ' / あいてに開いたかど=[' + cornersLegal(b0, opp).join(' ') + ']→['
        + cornersLegal(b1, opp).join(' ') + ']'
    + ' / 4手いないに あいてが取ったかど=' + took
    + ' / あいてが1手返した時 自分に残る手=' + myLeft
    + ' / 手数=' + w.ply + ' / ひっくり返し=' + w.flips + ' / 場面=' + w.phase;
}

print('採点の読み＝' + JSON.stringify(OKB.getJudgeSearch())
  + ' ／ しきい値＝' + JSON.stringify(OKB.getThresholds()));

var i, c, res, w;
for (i = 0; i < data.cases.length; i++) {
  c = data.cases[i];
  res = OKB.judge(c.moves, c.childColor);
  print('=========================================================');
  print((i + 1) + '. 凍結時の名前 = ' + c.name);
  print('   凍結時に期待していた理由 = ' + c.expect
    + ' ／ いまの判定器の型 = ' + (res.worst ? res.worst.type.key : 'NOBLUNDER'));
  if (!res.worst) {
    print('   悪手なし（この局の悪手の数=0）');
    continue;
  }
  w = res.worst;
  print('   うったマス=' + sqName(w.sq) + '  そん=' + w.loss + '(' + w.phase + ')'
    + '  そのとき おけた手=' + w.legalCount + '  この局の悪手=' + res.blunders.length + '個');
  print('   こどもの色 = ' + (c.childColor === OK.BLACK ? 'くろ #' : 'しろ O')
    + '   ! = うったところ   * = そのあと あいてが とった かど');
  print(drawBoard(w.boardBefore, w.sq, w.oppCorner));
  var nx = [], k;
  for (k = w.ply + 1; k < c.moves.length && k <= w.ply + 4; k++) {
    nx.push((c.moves[k].player === OK.BLACK ? '#' : 'O') + sqName(c.moves[k].sq));
  }
  print('   このあとの4手 = ' + nx.join(' '));
  print('   事実 = ' + facts(w, c.moves, c.childColor));
}
