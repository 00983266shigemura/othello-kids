#!/usr/bin/env python3
"""P3の測定結果を表にする（工程1）

使い方＝ python3 report_p3.py p3_result.json
"""
import json
import math
import sys


def main():
    with open(sys.argv[1], encoding="utf-8") as fp:
        d = json.load(fp)
    rows = d["results"]
    n = d["games"]

    pair = {}
    prox = {}
    for r in rows:
        if r["kind"] == "pair":
            pair[int(r["b"][1:])] = r          # b = 下の段
        else:
            prox.setdefault(r["a"], {})[int(r["b"][1:])] = r

    print("P3(a) 隣り合う段（%d局・上の段から見た勝率。合格=0.60以上）" % n)
    print("%-10s %8s %10s %16s %6s %6s"
          % ("くらべる段", "上の勝率", "勝-敗-分", "95%はんい", "60%", "逆転なし"))
    ng_a, ng_rev = [], []
    se = lambda s: (s * (1 - s) / n) ** 0.5
    for low in sorted(pair):
        r = pair[low]
        s = r["aScore"]
        half = 1.96 * se(s)
        ok = s >= 0.60
        no_rev = (s - half) > 0.50      # 下限が5割超＝逆転していないと言い切れる
        if not ok:
            ng_a.append((low, low + 1, s))
        if not no_rev:
            ng_rev.append((low, low + 1, s))
        print("%-10s %8.3f %10s %16s %6s %6s"
              % ("L%d→L%d" % (low, low + 1), s,
                 "%d-%d-%d" % (r["aWin"], r["bWin"], r["draw"]),
                 "%.3f〜%.3f" % (s - half, s + half),
                 "OK" if ok else "NG", "OK" if no_rev else "NG"))

    print("\nP3(b) 子ども代理から見た勝率（%d局。単調に下がること。L1〜L3は0.70以上）" % n)
    print("%-6s %14s %16s" % ("段", "たくさん とる", "たくさん とる＋かど"))
    keys = ["Pgreedy", "PgreedyCorner"]
    prev = {k: None for k in keys}
    ng_mono, ng_low, ng_mono_strict = [], [], []
    for lv in range(1, 21):
        cells = []
        for k in keys:
            s = prox[k][lv]["aScore"]
            mark = ""
            # ばらつきの範囲（2×標準誤差）を超えて上がった時だけ「単調でない」と数える。
            # 勝率0%あたりでは測りようがないため（200局の標準誤差＝最大3.5%）。
            tol = 2.0 * ((max(s, 0.02) * (1 - max(s, 0.02)) / n) ** 0.5)
            if prev[k] is not None and s > prev[k]:
                ng_mono_strict.append((k, lv, prev[k], s))
            if prev[k] is not None and s > prev[k] + tol:
                mark = " ↑"
                ng_mono.append((k, lv, prev[k], s))
            elif prev[k] is not None and s > prev[k]:
                mark = " ~"
            prev[k] = s
            cells.append("%.3f%s" % (s, mark))
            if lv <= 3 and s < 0.70:
                ng_low.append((k, lv, s))
        print("%-6s %14s %16s" % ("L%d" % lv, cells[0], cells[1]))

    print("\n--- 判定 ---")
    # P3(a) の述語＝2026-09-21 しげ裁定「問い1もA案で承認」で次の形に確定した。
    #   ①19組の平均勝率が60%以上  ②どの組も測り値50%以上（＝逆転が1つも無い）
    # 旧文言（各組が60%以上）は20段では満たしようがないことが計算で確定したため置き換えた。
    avg = sum(pair[k]["aScore"] for k in pair) / len(pair)
    worst = min(pair[k]["aScore"] for k in pair)
    worst_pair = min(pair, key=lambda k: pair[k]["aScore"])
    c1, c2 = avg >= 0.60, worst >= 0.50
    print("P3(a)【2026-09-21しげ承認の述語】 = %s" % ("合格" if (c1 and c2) else "不合格"))
    print("   ①19組の平均勝率 %.3f ≧ 0.60 → %s" % (avg, "OK" if c1 else "NG"))
    print("   ②いちばん低い組 L%d→L%d = %.3f ≧ 0.50（逆転ゼロ） → %s"
          % (worst_pair, worst_pair + 1, worst, "OK" if c2 else "NG"))
    print("  ↓以下は合否ではなく参考値（旧文言での状況と、その理由）")
    print("P3(a) 旧文言（隣り合う各組が60%%以上）では 60%%未満 %d件 %s"
          % (len(ng_a), ng_a if ng_a else ""))
    print("P3(a) 逆転を否定できない段（95%%はんいの下限が5割以下） = %d件 %s"
          % (len(ng_rev), ng_rev if ng_rev else ""))
    print("P3(a) 19段の平均勝率 = %.3f"
          % (sum(pair[k]["aScore"] for k in pair) / len(pair)))
    # 19段ぶんの強さの差を足すと、L1からL20までの全幅（イロ点）になる
    span = sum(-400.0 * math.log10(1.0 / min(max(pair[k]["aScore"], 0.01), 0.99) - 1.0)
               for k in pair)
    print("P3(a) L1からL20までの強さの全幅 = %.0f 点（1段あたり %.1f 点）"
          % (span, span / len(pair)))
    need60 = -400.0 * math.log10(1.0 / 0.60 - 1.0) * len(pair)
    need65 = -400.0 * math.log10(1.0 / 0.65 - 1.0) * len(pair)
    print("      参考＝19段すべてを60%%にするには %.0f 点、65%%にするには %.0f 点が要る"
          % (need60, need65))
    # 色の偏り＝上の段が くろ番／しろ番 でどれだけ勝っているか。
    # 引き分けは色別に記録していないため、勝ち数だけで出す（引き分けを0.5と数えていない）
    bw = sum(pair[k]["aAsBlack"]["win"] for k in pair)
    bn = sum(pair[k]["aAsBlack"]["n"] for k in pair)
    ww = sum(pair[k]["aAsWhite"]["win"] for k in pair)
    wn = sum(pair[k]["aAsWhite"]["n"] for k in pair)
    print("P3(a) 色の偏り（上の段の勝ち数÷局数・引き分けは含めない）＝"
          "くろ番 %.3f（%d/%d）／しろ番 %.3f（%d/%d）"
          % (bw / bn, bw, bn, ww / wn, ww, wn))
    print("P3(b) 単調でない所【設計書の文言どおり＝1度でも上がったら違反】 = %d件 %s"
          % (len(ng_mono_strict), ng_mono_strict if ng_mono_strict else ""))
    print("P3(b) 単調でない所【ばらつき2×標準誤差を超えた上昇だけ数える・"
          "＝しげ未承認の読み替え】 = %d件 %s"
          % (len(ng_mono), ng_mono if ng_mono else ""))
    print("P3(b) L1〜L3で70%%未満 = %d件 %s" % (len(ng_low), ng_low if ng_low else ""))


if __name__ == "__main__":
    main()
