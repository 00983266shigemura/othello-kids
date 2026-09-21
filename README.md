# つよくなるオセロ

しげの息子（6歳）が、2012年のiPad（iOS 10.3.3・Safari 10.1相当）で遊ぶオセロ学習アプリ。

- 目的＝息子がオセロを通じて知的に成長すること
- 設計の正本＝vault `30_generated/reports/othello_kids_design_20260921.html`
- 実機の速さ＝vault `30_generated/reports/othello_kids_speed_20260921.html`
- 工程1の結果＝vault `30_generated/reports/othello_kids_phase1_20260921.html`
- トラックの現在地＝vault `10_projects/othello_kids/SESSION_STATE.md`

このリポジトリはまだ公開していない。公開（GitHub Pages）は工程4で、しげの動詞形指示を待つ。

## 置き場

```
hayasa/index.html    工程0.5「はやさ はかり」＝実機の速さを1回測るページ（役目は済み）
tools/               中身と、Macで測るための道具
```

## 実機へ載るファイル（アプリの中身）

| ファイル | 役割 |
|---|---|
| `tools/core.js` | オセロの規則・盤・読み（先読みと終盤の完全読み）・読む局面の数の上限 |
| `tools/ai.js` | 20段の梯子・1手の選び方・子ども代理2種・1局うつ仕組み |
| `tools/blunder.js` | 負けたときの理由（悪手の判定と型の名づけ） |

古いSafariで動く書き方（ES5）だけで書く。`let` `const` アロー関数 テンプレート文字列 `?.` `??` を
1文字でも混ぜるとファイル全体が動かない（実測）。検査＝`python3 tools/check_es5.py tools/core.js tools/ai.js tools/blunder.js`

## Macで測るための道具（アプリには入らない）

すべて `jsc`（macOS標準のJavaScript実行系）で動く。

```
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
```

| ファイル | 何をするか |
|---|---|
| `tools/selfplay.js` | 好きな相手どうしをN局戦わせて勝率を出す |
| `tools/run_p3.py` / `report_p3.py` | 判定述語P3（梯子の段差・子ども代理）を測って表にする |
| `tools/test_blunder.js` | 判定述語P4（悪手の理由づけ）の試験。棋譜は `fixtures_p4.json` |
| `tools/make_fixtures.js` / `freeze_fixtures.py` | P4の試験用の棋譜をさがして凍結する |
| `tools/time_check.js` / `node_dist.js` | 1手に読む局面の数と、その分布を測る（判定述語P5） |
| `tools/check_es5.py` | 古いSafariで動かない書き方が混ざっていないか見る |
| `tools/run_gauntlet*.py` / `run_chain.py` / `pick_*.py` | 梯子の目もりを決めるための強さ測定 |
| `tools/bench_mac.js` | Macの速さの基準（工程0.5で使った台本） |

## よく使う1行

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/check_es5.py /Users/shigemurasatoshi/dev/othello-kids/tools/core.js /Users/shigemurasatoshi/dev/othello-kids/tools/ai.js /Users/shigemurasatoshi/dev/othello-kids/tools/blunder.js
```

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc /Users/shigemurasatoshi/dev/othello-kids/tools/test_blunder.js
```

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/report_p3.py /Users/shigemurasatoshi/dev/othello-kids/tools/p3_result_v5.json
```
