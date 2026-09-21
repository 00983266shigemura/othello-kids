#!/usr/bin/env python3
"""つよくなるオセロ ── 梯子の材料を並べるための実測（工程1）

やること＝候補の打ちかたを、決まった基準の相手5種と戦わせて、
すべての結果から強さの目もり（イロ点）を一度に推定する。
基準の相手5種も候補に入れてあるので、基準どうしの強さ差も同じ推定に入る。

使い方＝ python3 run_gauntlet.py 出力JSON
"""
import json
import math
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
GAMES = 100
OPENING = 4

# 基準の相手＝弱い所から強い所まで5つ（どれも候補の中にある書き方で指定する）
ANCHORS = ["C:rand=1", "C:depth=1,eps=0.4", "C:depth=2,eps=0",
           "C:depth=4,eps=0", "C:depth=6,end=12,eps=0"]


def candidates():
    out = []
    for bad in (0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1):
        out.append("C:bad=%g" % bad)
    out.append("C:rand=1")
    out.append("C:corner=0.5")
    out.append("C:corner=1")
    for eps in (0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0):
        out.append("C:depth=1,eps=%g" % eps)
    for eps in (0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0):
        out.append("C:depth=2,eps=%g" % eps)
    for eps in (0.5, 0.4, 0.3, 0.2, 0.1, 0):
        out.append("C:depth=3,eps=%g" % eps)
    for eps in (0.4, 0.3, 0.2, 0.1, 0):
        out.append("C:depth=4,eps=%g" % eps)
    for eps in (0.2, 0.1, 0):
        out.append("C:depth=4,end=8,eps=%g" % eps)
    for eps in (0.3, 0.2, 0.1, 0):
        out.append("C:depth=5,end=10,eps=%g" % eps)
    for eps in (0.4, 0.3, 0.2, 0.15, 0.1, 0.05, 0):
        out.append("C:depth=6,end=12,eps=%g" % eps)
    # 子ども代理も同じものさしに載せる（P3(b)の読み取りに使う）
    out.append("Pgreedy")
    out.append("PgreedyCorner")
    seen, uniq = set(), []
    for c in out:
        if c not in seen:
            seen.add(c)
            uniq.append(c)
    return uniq


def run_one(a, b, seed, games=GAMES):
    cmd = [JSC, os.path.join(HERE, "selfplay.js"), "--",
           "a=%s" % a, "b=%s" % b, "games=%d" % games,
           "seed=%d" % seed, "opening=%d" % OPENING]
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=HERE)
    if out.returncode != 0:
        raise RuntimeError("jsc failed: %s\n%s\n%s" % (cmd, out.stdout, out.stderr))
    return json.loads(out.stdout.strip().splitlines()[-1])


def fit_elo(players, matches, iters=6000, lr=6.0):
    """Bradley-Terry の最尤推定をゆっくりの勾配法で解く。
    matches = [(a, b, n, score_a)] ／ 平均0点に固定する。"""
    r = {p: 0.0 for p in players}
    k = math.log(10.0) / 400.0
    for _ in range(iters):
        grad = {p: 0.0 for p in players}
        for a, b, n, sa in matches:
            pa = 1.0 / (1.0 + math.exp(-k * (r[a] - r[b])))
            g = n * (sa - pa)
            grad[a] += g
            grad[b] -= g
        for p in players:
            r[p] += lr * grad[p] / max(1, len(matches))
        m = sum(r.values()) / len(r)
        for p in players:
            r[p] -= m
    return r


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "gauntlet.json")
    cands = candidates()
    jobs = []
    for ci, c in enumerate(cands):
        for ai, aspec in enumerate(ANCHORS):
            if c == aspec:
                continue
            jobs.append((c, aspec, 9000 + ci * 37 + ai))

    print("試合数 = %d 組 × %d局" % (len(jobs), GAMES), flush=True)
    matches, scores = [], {}
    done = [0]
    with ThreadPoolExecutor(max_workers=9) as ex:
        futs = [(c, aspec, ex.submit(run_one, c, aspec, seed))
                for c, aspec, seed in jobs]
        for c, aspec, f in futs:
            r = f.result()
            matches.append((c, aspec, GAMES, r["aScore"]))
            scores.setdefault(c, {})[aspec] = r["aScore"]
            done[0] += 1
            if done[0] % 20 == 0:
                print("  ... %d / %d" % (done[0], len(jobs)), flush=True)

    elo = fit_elo(cands, matches)
    table = [{"spec": c, "elo": round(elo[c], 1), "scores": scores.get(c, {})}
             for c in cands]
    table.sort(key=lambda r: r["elo"])
    for r in table:
        print("%-34s elo=%8.1f   %s"
              % (r["spec"], r["elo"],
                 " ".join("%.2f" % r["scores"].get(a, -1) for a in ANCHORS)))

    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({"games": GAMES, "anchors": ANCHORS, "table": table,
                   "matches": matches}, fp, ensure_ascii=False, indent=1)
    print("\n書き出し = %s" % dest)


if __name__ == "__main__":
    main()
