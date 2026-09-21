#!/usr/bin/env python3
"""つよくなるオセロ ── 実測の強さ表から20段を選ぶ（工程1）

選び方＝「隣り合う段の差のうち一番小さいもの」を、できるだけ大きくする。
しばり＝レベル1〜3は、子ども代理が70%以上勝てる強さより弱いこと（判定述語P3(b)）。

使い方＝ python3 pick_ladder.py gauntlet.json [段数]
"""
import json
import math
import sys

PROXIES = ("Pgreedy", "PgreedyCorner")


def elo_gap(p):
    return -400.0 * math.log10(1.0 / p - 1.0)


def win_prob(gap):
    return 1.0 / (1.0 + 10.0 ** (-gap / 400.0))


def feasible(elos, n, gap, cap_first3):
    """弱い方から順に、差が gap 以上になる候補を貪欲に取る。n個取れたら True"""
    picks = []
    for e in elos:
        if picks and e - picks[-1] < gap:
            continue
        if len(picks) < 3 and cap_first3 is not None and e > cap_first3:
            return None
        picks.append(e)
        if len(picks) == n:
            return picks
    return None


def main():
    with open(sys.argv[1], encoding="utf-8") as fp:
        d = json.load(fp)
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 20

    prox = {r["spec"]: r["elo"] for r in d["table"] if r["spec"] in PROXIES}
    table = sorted([r for r in d["table"] if r["spec"] not in PROXIES],
                   key=lambda r: r["elo"])
    elos = [r["elo"] for r in table]
    by_elo = {r["elo"]: r["spec"] for r in table}

    # レベル1〜3の上限＝代理が70%勝てる位置（きびしい方の代理で決まる）
    cap = min(prox[k] - elo_gap(0.70) for k in prox)
    print("候補 = %d件   幅 = %.0f 〜 %.0f （%.0f点）" % (len(elos), elos[0], elos[-1],
                                                    elos[-1] - elos[0]))
    print("代理の位置 = " + "  ".join("%s %.0f" % (k, v) for k, v in prox.items())
          + "  → レベル1〜3の上限 = %.0f 点" % cap)

    lo, hi = 0.0, (elos[-1] - elos[0]) / (n - 1) + 1
    best = None
    for _ in range(60):
        mid = (lo + hi) / 2
        got = feasible(elos, n, mid, cap)
        if got:
            best, lo = (mid, got), mid
        else:
            hi = mid
    if not best:
        print("！ %d段は取れない" % n)
        return
    gap, picks = best
    print("\n取れた最小の差 = %.1f 点 → その段の見込み勝率 = %.3f"
          % (gap, win_prob(gap)))

    print("\n%-4s %-32s %9s %8s %8s %8s %8s"
          % ("段", "設定", "イロ点", "隣との差", "見込勝率", "代理A", "代理B"))
    out = []
    for i, e in enumerate(picks):
        g = e - picks[i - 1] if i else 0.0
        wp = win_prob(g) if i else 0.0
        pa = win_prob(prox["Pgreedy"] - e)
        pb = win_prob(prox["PgreedyCorner"] - e)
        out.append({"level": i + 1, "spec": by_elo[e], "elo": e,
                    "gap": round(g, 1), "winProb": round(wp, 3),
                    "proxyGreedy": round(pa, 3), "proxyGreedyCorner": round(pb, 3)})
        print("%-4s %-32s %9.1f %8.1f %8.3f %8.3f %8.3f%s"
              % ("L%d" % (i + 1), by_elo[e], e, g, wp, pa, pb,
                 "" if (i == 0 or wp >= 0.60) else "   NG"))

    with open("ladder_pick.json", "w", encoding="utf-8") as fp:
        json.dump({"minGap": round(gap, 1), "levels": out}, fp,
                  ensure_ascii=False, indent=1)
    print("\n書き出し = ladder_pick.json")


if __name__ == "__main__":
    main()
