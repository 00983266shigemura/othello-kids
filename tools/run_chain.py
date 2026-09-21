#!/usr/bin/env python3
"""つよくなるオセロ ── つまみの目もりを「隣どうし直接対戦」で測る（工程1・最終調整）

1つ前のやり方（基準5種との対戦からイロ点を推定）は、隣どうしの細かい差を測るには粗かった。
ここでは細かい目もりを一列に並べ、隣どうしだけを200局ずつ当てて、その差を積み上げる。
判定述語P3(a)が測るのは「隣どうしの勝率」そのものなので、この測り方が目的に合う。

使い方＝ python3 run_chain.py 出力JSON
"""
import json
import math
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from run_gauntlet import run_one  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
GAMES = 200

# 弱いと思われる順に並べる（順が違っても差は正しく出る）
CHAIN = (
    ["C:bad=%g,badDepth=4" % b for b in
     (1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1)]
    + ["C:rand=1"]
    + ["C:depth=6,end=12,eps=%g" % e for e in
       (0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38,
        0.32, 0.26, 0.21, 0.16, 0.12)]
    + ["C:depth=6,eps=0", "C:depth=6,end=8,eps=0",
       "C:depth=6,end=10,eps=0", "C:depth=6,end=12,eps=0"]
)


def elo_of(score):
    s = min(max(score, 0.01), 0.99)
    return -400.0 * math.log10(1.0 / s - 1.0)


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "chain.json")
    links = [(CHAIN[i + 1], CHAIN[i], 61000 + i * 97) for i in range(len(CHAIN) - 1)]
    print("つなぎ目 = %d 個 × %d局" % (len(links), GAMES), flush=True)

    results = []
    done = [0]
    with ThreadPoolExecutor(max_workers=9) as ex:
        futs = [(a, b, ex.submit(run_one, a, b, seed, GAMES)) for a, b, seed in links]
        for a, b, f in futs:
            r = f.result()
            results.append((a, b, r["aScore"]))
            done[0] += 1
            if done[0] % 5 == 0:
                print("  ... %d / %d" % (done[0], len(links)), flush=True)

    # 積み上げてイロ点の曲線にする（一番弱いものを0点とする）
    elo, cur = {CHAIN[0]: 0.0}, 0.0
    for (a, b, s) in results:
        cur += elo_of(s)
        elo[a] = cur

    print("\n%-34s %9s %9s %9s" % ("設定", "イロ点", "1つ前との差", "勝率"))
    prev = None
    score_of = {a: s for a, b, s in results}
    for c in CHAIN:
        d = elo[c] - elo[prev] if prev else 0.0
        print("%-34s %9.1f %9.1f %9s"
              % (c, elo[c], d, ("%.3f" % score_of[c]) if c in score_of else "-"))
        prev = c

    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({"games": GAMES,
                   "table": [{"spec": c, "elo": round(elo[c], 1)} for c in CHAIN],
                   "links": results}, fp, ensure_ascii=False, indent=1)
    print("\n書き出し = %s" % dest)


if __name__ == "__main__":
    main()
