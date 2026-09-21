/* つよくなるオセロ ── 悪手判定器の試験（判定述語P4）
   合格＝期待する理由を付けた棋譜10本のうち9本以上で一致する。
   使い方＝ jsc test_blunder.js
   期待する理由は fixtures_p4.json に凍結してある（人が盤と事実を見て決めたもの）。 */

var HERE = '/Users/shigemurasatoshi/dev/othello-kids/tools/';
load(HERE + 'core.js');
load(HERE + 'ai.js');
load(HERE + 'blunder.js');

var data = JSON.parse(readFile(HERE + 'fixtures_p4.json'));
var cases = data.cases;
var i, c, res, got, ok, nOk = 0, lines = [];

for (i = 0; i < cases.length; i++) {
  c = cases[i];
  res = OKB.judge(c.moves, c.childColor);
  got = res.worst ? res.worst.type.key : 'NOBLUNDER';
  ok = (got === c.expect);
  if (ok) { nOk++; }
  lines.push((ok ? 'OK  ' : 'NG  ')
    + (i + 1) + '. ' + c.name
    + '  期待=' + c.expect + '  判定=' + got
    + (res.worst ? ('  そん=' + res.worst.loss + '(' + res.worst.phase + ')'
        + ' ply=' + res.worst.ply) : '  悪手なし'));
}

print(lines.join('\n'));
print('');
/* 合格条件＝設計書は「10本のうち9本以上」＝9割。
   本数を増やしたときに基準が緩まないよう、割合で見る（査読の指摘・2026-09-21）。 */
var rate = nOk / cases.length;
print('一致 = ' + nOk + ' / ' + cases.length
  + '（' + Math.round(rate * 1000) / 10 + '%）'
  + '   採点の読み = ' + JSON.stringify(OKB.getJudgeSearch())
  + '   しきい値（中盤/終盤）= ' + JSON.stringify(OKB.getThresholds()));
print('P4 = ' + (cases.length >= 10 && rate >= 0.9 ? 'PASS' : 'FAIL')
  + '（合格条件＝10本以上、かつ9割以上が一致）');
