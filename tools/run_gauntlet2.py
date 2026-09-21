#!/usr/bin/env python3
"""つよくなるオセロ ── 梯子の「一番下」をもっと弱くできるか測る（工程1・追加分）

1回目の結果（gauntlet_v1.json）の試合をそのまま使い、新しい候補の試合を足して
同じものさしの上でイロ点を出し直す。

使い方＝ python3 run_gauntlet2.py 1回目のJSON 出力JSON
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from run_gauntlet import fit_elo, run_one, GAMES  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# 弱い所をはかるので、基準も弱い相手にそろえる
ANCHORS = ["C:rand=1", "C:bad=0.9", "Pgreedy", "C:depth=1,eps=0.4"]

NEW = [
    "C:bad=1",
    "C:bad=1,badDepth=2",
    "C:bad=0.9,badDepth=2",
    "C:bad=0.8,badDepth=2",
    "C:bad=0.6,badDepth=2",
    "C:bad=0.4,badDepth=2",
    "C:bad=1,badDepth=3",
    "C:bad=0.8,badDepth=3",
    "C:bad=0.6,badDepth=3",
    "C:bad=0.4,badDepth=3",
    "C:bad=1,badDepth=4",
    "C:bad=0.8,badDepth=4",
]


def main():
    src = sys.argv[1]
    dest = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "gauntlet2.json")
    with open(src, encoding="utf-8") as fp:
        old = json.load(fp)
    matches = [tuple(m) for m in old["matches"]]
    scores = {r["spec"]: dict(r["scores"]) for r in old["table"]}

    jobs = []
    for ci, c in enumerate(NEW):
        for ai, a in enumerate(ANCHORS):
            jobs.append((c, a, 41000 + ci * 53 + ai))
    print("あたらしい試合 = %d 組 × %d局" % (len(jobs), GAMES), flush=True)

    with ThreadPoolExecutor(max_workers=9) as ex:
        futs = [(c, a, ex.submit(run_one, c, a, seed)) for c, a, seed in jobs]
        for c, a, f in futs:
            r = f.result()
            matches.append((c, a, GAMES, r["aScore"]))
            scores.setdefault(c, {})[a] = r["aScore"]

    players = sorted({m[0] for m in matches} | {m[1] for m in matches})
    elo = fit_elo(players, matches)
    table = [{"spec": p, "elo": round(elo[p], 1), "scores": scores.get(p, {}),
              "isNew": p in NEW} for p in players]
    table.sort(key=lambda r: r["elo"])
    for r in table:
        print("%-32s elo=%8.1f %s" % (r["spec"], r["elo"], "←あたらしい" if r["isNew"] else ""))

    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({"games": GAMES, "table": table, "matches": matches},
                  fp, ensure_ascii=False, indent=1)
    print("\n書き出し = %s" % dest)


if __name__ == "__main__":
    main()
