# つよくなるオセロ

しげの息子（6歳）が、2012年のiPad（iOS 10.3.3・Safari 10.1相当）で遊ぶオセロ学習アプリ。

- 目的＝息子がオセロを通じて知的に成長すること
- 設計の正本＝vault `30_generated/reports/othello_kids_design_20260921.html`
- 実機の速さ＝vault `30_generated/reports/othello_kids_speed_20260921.html`
- 工程1の結果＝vault `30_generated/reports/othello_kids_phase1_20260921.html`
- 工程2の結果＝vault `30_generated/reports/othello_kids_phase2_20260921.html`
- トラックの現在地＝vault `10_projects/othello_kids/SESSION_STATE.md`

このリポジトリはまだ公開していない。公開（GitHub Pages）は工程4で、しげの動詞形指示を待つ。

## 置き場

```
index.html           アプリ本体（1枚で完結）。build_app.py が組み立てる＝手で直さない
icon.png             ホーム画面の絵（180×180・透明なし）。make_icon.py が作る＝手で置き換えない
version.txt          版数。index.html の中の APP_VERSION と同じ数字（自動更新の合図）
push.zsh             公開へ反映する台本。しげが1行で実行する
hayasa/index.html    工程0.5「はやさ はかり」＝実機の速さを1回測るページ（役目は済み）
tools/               中身（部品）と、Macで測る・試すための道具
```

**`index.html` を直接いじらない。** 部品を直して `python3 tools/build_app.py` で組み立て直す。
手で直すと、Macの試験台本（部品を読む）と実機のページ（組み立て済み）が別物になる。

## 実機へ載るファイル（アプリの中身）

| ファイル | 役割 |
|---|---|
| `tools/core.js` | オセロの規則・盤・読み（先読みと終盤の完全読み）・読む局面の数の上限 |
| `tools/ai.js` | 20段の梯子・1手の選び方（途中で止められる形）・子ども代理2種・1局うつ仕組み |
| `tools/blunder.js` | 負けたときの理由（悪手の判定と型の名づけ・途中で止められる形） |
| `tools/rules.js` | レベルの開きかた・端末内の保存・スタンプ・レクチャの段階（画面に触らない） |
| `tools/text.js` | 画面に出すことば を ぜんぶ ここに集めてある |
| `tools/ui.js` | 画面・そうさ・おと。相手の読みと採点を setTimeout(0) で少しずつ進める |
| `tools/app_template.html` | HTMLの骨と見た目（CSS）。部品を差し込む穴が開いている |
| `tools/make_icon.py` | ホーム画面の絵を作る唯一の道具。色はテンプレートと同じ名札を使う |

古いSafariで動く書き方（ES5）だけで書く。`let` `const` アロー関数 テンプレート文字列 `?.` `??` を
1文字でも混ぜるとファイル全体が動かない（実測）。組み立てのたびに機械で検査している。

## よく使う1行

アプリを組み立て直す（本番）。

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/build_app.py
```

音の鳴らない複製を作る（試験・目視用。複製を作る道はこれ1本だけ）。

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/build_app.py --silent _test.html
```

ホーム画面の絵を作り直す（色や形を変えたとき）。

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/make_icon.py
```

画面の文字に漢字が無いか・絵文字の世代（判定述語P7）。

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/check_text.py
```

記録ときまりの試験（判定述語P2・P1の道すじ）。

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc /Users/shigemurasatoshi/dev/othello-kids/tools/test_rules.js
```

負け理由の判定器の試験（判定述語P4）。

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc /Users/shigemurasatoshi/dev/othello-kids/tools/test_blunder.js
```

画面が止まる いちばん長い時間（判定述語P5・P9）。

```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc /Users/shigemurasatoshi/dev/othello-kids/tools/chunk_check.js
```

古い書き方が混ざっていないか。

```bash
python3 /Users/shigemurasatoshi/dev/othello-kids/tools/check_es5.py /Users/shigemurasatoshi/dev/othello-kids/tools/core.js /Users/shigemurasatoshi/dev/othello-kids/tools/ai.js /Users/shigemurasatoshi/dev/othello-kids/tools/blunder.js /Users/shigemurasatoshi/dev/othello-kids/tools/rules.js /Users/shigemurasatoshi/dev/othello-kids/tools/text.js /Users/shigemurasatoshi/dev/othello-kids/tools/ui.js
```

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
| `tools/test_rules.js` | 判定述語P2（レベルの開きかた）と保存・スタンプの試験 |
| `tools/chunk_check.js` | 画面が止まる いちばん長い時間（判定述語P5・P9）を実機の秒に直して出す |
| `tools/snapshot_behavior.js` / `diff_behavior.py` | 中身を作り替える前と後で、打ち手と採点が1つも変わっていないかを突き合わせる |
| `tools/make_fixtures.js` / `freeze_fixtures.py` | P4の試験用の棋譜をさがして凍結する |
| `tools/time_check.js` / `node_dist.js` | 1手に読む局面の数と、その分布を測る |
| `tools/check_es5.py` | 古いSafariで動かない書き方が混ざっていないか見る |
| `tools/check_text.py` | 画面の文字に漢字が無いか・絵文字の世代を見る（判定述語P7） |
| `tools/run_gauntlet*.py` / `run_chain.py` / `pick_*.py` | 梯子の目もりを決めるための強さ測定 |
| `tools/bench_mac.js` | Macの速さの基準（工程0.5で使った台本） |
