#!/usr/bin/env python3
"""つよくなるオセロ ── 2つのつまみの目もりを細かく測る（工程1・3回目）

つまみ①＝bad（わざと損をする手を打つ確率。badDepth=3 で固定）＝梯子の下半分
つまみ②＝eps（たまに でたらめを打つ確率。ふかさ6＋あき12で固定）＝梯子の上半分
この2つだけで梯子を作れるか、目もりを細かく測って確かめる。

使い方＝ python3 run_gauntlet3.py もとのJSON 出力JSON
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from run_gauntlet import fit_elo, run_one, GAMES  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

ANCHORS = ["C:rand=1", "C:bad=0.9", "C:depth=1,eps=0.4",
           "C:depth=4,eps=0", "C:depth=6,end=12,eps=0"]

NEW = (
    ["C:bad=%g,badDepth=3" % b for b in
     (1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1)]
    + ["C:depth=6,end=12,eps=%g" % e for e in
       (0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.35, 0.25, 0.18, 0.12, 0.08, 0.03)]
)


def main():
    src, dest = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as fp:
        old = json.load(fp)
    matches = [tuple(m) for m in old["matches"]]
    scores = {r["spec"]: dict(r["scores"]) for r in old["table"]}
    known = {m[0] for m in matches} | {m[1] for m in matches}

    jobs = []
    for ci, c in enumerate(NEW):
        if c in known:
            continue
        for ai, a in enumerate(ANCHORS):
            if c == a:
                continue
            jobs.append((c, a, 77000 + ci * 59 + ai))
    print("あたらしい試合 = %d 組 × %d局" % (len(jobs), GAMES), flush=True)

    done = [0]
    with ThreadPoolExecutor(max_workers=9) as ex:
        futs = [(c, a, ex.submit(run_one, c, a, seed)) for c, a, seed in jobs]
        for c, a, f in futs:
            r = f.result()
            matches.append((c, a, GAMES, r["aScore"]))
            scores.setdefault(c, {})[a] = r["aScore"]
            done[0] += 1
            if done[0] % 15 == 0:
                print("  ... %d / %d" % (done[0], len(jobs)), flush=True)

    players = sorted({m[0] for m in matches} | {m[1] for m in matches})
    elo = fit_elo(players, matches)
    table = [{"spec": p, "elo": round(elo[p], 1), "scores": scores.get(p, {})}
             for p in players]
    table.sort(key=lambda r: r["elo"])
    for r in table:
        print("%-34s elo=%8.1f" % (r["spec"], r["elo"]))
    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({"games": GAMES, "table": table, "matches": matches},
                  fp, ensure_ascii=False, indent=1)
    print("\n書き出し = %s" % dest)


if __name__ == "__main__":
    main()
