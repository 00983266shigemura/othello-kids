#!/usr/bin/env python3
"""つよくなるオセロ ── 判定述語P3(a)が満たせるかを数で確かめる（工程1）

P3(a)＝「隣り合う段で、上の段の勝率が200局で60%以上」を19段ぶんすべて満たす、という条件。
強さの幅（イロ点）が足りていても、200局の測り値はばらつくので、
真の勝率が60%を少し超えているだけでは、19段すべてが60%以上になることは まず無い。
その確率を、幅・段数・局数を変えて出す。

使い方＝ python3 p3a_feasibility.py [実測の全幅イロ点]
"""
import math
import sys


def win_prob(gap):
    return 1.0 / (1.0 + 10.0 ** (-gap / 400.0))


def elo_gap(p):
    return -400.0 * math.log10(1.0 / p - 1.0)


def phi(z):
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def p_all_pass(span, levels, games, bar=0.60):
    """全幅 span を levels 段に等分したとき、games 局で測って
       すべての段が bar 以上になる確率"""
    steps = levels - 1
    true_p = win_prob(span / steps)
    se = math.sqrt(true_p * (1 - true_p) / games)
    one = 1.0 - phi((bar - true_p) / se)
    return true_p, one, one ** steps


def main():
    span = float(sys.argv[1]) if len(sys.argv) > 1 else 1506.0
    print("実測の全幅 = %.0f 点" % span)
    print("60%%を19段ぶん作るのに要る幅 = %.0f 点 → 幅は %s"
          % (elo_gap(0.60) * 19,
             "足りている" if span >= elo_gap(0.60) * 19 else "足りない"))

    print("\n【案A・C】段数を変えたとき（200局・基準60%%）")
    print("%6s %10s %12s %16s" % ("段数", "1段の勝率", "1段が通る率", "全段が通る率"))
    for lv in (20, 18, 16, 14, 12, 10):
        tp, one, allp = p_all_pass(span, lv, 200)
        print("%6d %10.3f %12.1f%% %15.1f%%" % (lv, tp, one * 100, allp * 100))

    print("\n【案B】20段のまま局数を増やしたとき（基準60%%）")
    print("%8s %10s %12s %16s" % ("局数", "1段の勝率", "1段が通る率", "全段が通る率"))
    for g in (200, 400, 1000, 2000, 5000):
        tp, one, allp = p_all_pass(span, 20, g)
        print("%8d %10.3f %12.1f%% %15.1f%%" % (g, tp, one * 100, allp * 100))

    print("\n【案A】20段・200局のまま、基準を下げたとき")
    print("%8s %12s %16s" % ("基準", "1段が通る率", "全段が通る率"))
    for bar in (0.60, 0.575, 0.55, 0.525):
        tp, one, allp = p_all_pass(span, 20, 200, bar)
        print("%8.3f %11.1f%% %15.1f%%" % (bar, one * 100, allp * 100))

    print("\n【案A改】「逆転していない」を基準にしたとき"
          "（95%%はんいの下限が50%%を超える＝200局で0.569以上）")
    tp, one, allp = p_all_pass(span, 20, 200, 0.569)
    print("  1段の真の勝率 %.3f ／ 1段が通る率 %.1f%% ／ 全段が通る率 %.1f%%"
          % (tp, one * 100, allp * 100))

    print("\n【案E】述語を「梯子ぜんたい」で測るとき"
          "（①19段の平均が60%%以上 ②どの段も50%%以上＝逆転ゼロ）")
    steps = 19
    tp = win_prob(span / steps)
    se1 = math.sqrt(tp * (1 - tp) / 200) / math.sqrt(steps)   # 平均の標準誤差
    p_mean = 1.0 - phi((0.60 - tp) / se1)
    se = math.sqrt(tp * (1 - tp) / 200)
    p_norev = (1.0 - phi((0.50 - tp) / se)) ** steps
    print("  1段の真の勝率 %.3f" % tp)
    print("  ①平均が60%%以上になる率 = %.1f%%（平均のばらつきは1段の 1/√19）" % (p_mean * 100))
    print("  ②19段すべてが50%%以上になる率 = %.1f%%" % (p_norev * 100))
    print("  ①と②の両方 = %.1f%%" % (p_mean * p_norev * 100))

    print("\n【案D】幅をどれだけ広げれば20段・200局・60%%が半々で通るか")
    for bar in (0.60,):
        need = None
        for s in range(1000, 4000, 10):
            tp, one, allp = p_all_pass(float(s), 20, 200, bar)
            if allp >= 0.5:
                need = s
                break
        print("  要る全幅 = %s 点（いまの %.0f 点に %s 点の上乗せ）"
              % (need, span, (need - span) if need else "—"))


if __name__ == "__main__":
    main()
