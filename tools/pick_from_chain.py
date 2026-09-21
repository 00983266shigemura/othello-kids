#!/usr/bin/env python3
"""つよくなるオセロ ── 直接対戦で測った目もりから20段を取り直す（工程1）

やること＝run_chain.py の曲線を使い、強さが等間隔になるよう
つまみの数字（bad と eps）を逆算する。上の3段だけは
「おわりを完全に読み始めるあきマス数」で分ける（epsは0に張りついて差が出ないため）。

使い方＝ python3 pick_from_chain.py chain.json
"""
import json
import sys


def monotone(points):
    """測り値のゆらぎで前後した所をならす（強さは必ず上がる向きにする）"""
    out, hi = [], None
    for name, elo in points:
        hi = elo if hi is None else max(hi, elo)
        out.append((name, hi))
    return out


def interp(points, target):
    """(つまみの値, イロ点) の並びから、目標のイロ点に当たるつまみの値を出す"""
    for i in range(len(points) - 1):
        (p0, e0), (p1, e1) = points[i], points[i + 1]
        if e0 <= target <= e1:
            if e1 == e0:
                return p1
            t = (target - e0) / (e1 - e0)
            return p0 + (p1 - p0) * t
    return points[-1][0] if target > points[-1][1] else points[0][0]


def main():
    with open(sys.argv[1], encoding="utf-8") as fp:
        chain = json.load(fp)
    elo = {r["spec"]: r["elo"] for r in chain["table"]}

    # つまみ①＝bad（badDepth=4）。値が小さいほど強い＝並びは 1.0 → 0
    bad_vals = [1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]
    badA = monotone([(b, elo["C:bad=%g,badDepth=4" % b]) for b in bad_vals]
                    + [(0.0, elo["C:rand=1"])])

    # つまみ②＝eps（ふかさ6・あき12から完全読み）。1.0＝ほぼでたらめ → 0＝まちがえない
    eps_vals = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38,
                0.32, 0.26, 0.21, 0.16, 0.12]
    epsA = monotone([(1.0, elo["C:rand=1"])]
                    + [(e, elo["C:depth=6,end=12,eps=%g" % e]) for e in eps_vals])

    top = [("C:depth=6,eps=0", elo["C:depth=6,eps=0"]),
           ("C:depth=6,end=10,eps=0", elo["C:depth=6,end=10,eps=0"]),
           ("C:depth=6,end=12,eps=0", elo["C:depth=6,end=12,eps=0"])]

    lo, hi = badA[0][1], top[-1][1]
    n = 20
    step = (hi - lo) / (n - 1)
    print("全幅 = %.1f 点 ／ 1段 = %.1f 点 ／ 見込み勝率 = %.3f"
          % (hi - lo, step, 1 / (1 + 10 ** (-step / 400))))

    picks = []
    for i in range(n):
        t = lo + step * i
        if i >= n - 3:                      # 上の3段は決め打ち
            spec, e = top[i - (n - 3)]
            picks.append((spec, e, t))
        elif t <= badA[-1][1]:              # まだ bad のはんい
            b = interp(badA, t)
            picks.append(("bad=%.3f" % b, t, t))
        else:                               # eps のはんい
            e = interp(epsA, t)
            picks.append(("eps=%.3f" % e, t, t))

    print("\n%-4s %-26s %10s" % ("段", "つまみ", "ねらうイロ点"))
    for i, (spec, e, t) in enumerate(picks):
        print("%-4s %-26s %10.1f" % ("L%d" % (i + 1), spec, t))


if __name__ == "__main__":
    main()
