#!/usr/bin/env python3
"""つよくなるオセロ ── 判定述語P3の測定（工程1）

P3(a) 隣り合う段で、上の段の勝率が60%以上か（200局）
P3(b) 子ども代理2種に対して、各段の勝率が単調に下がるか。レベル1〜3は代理が70%以上勝てるか（200局）

使い方＝ python3 run_p3.py [出力JSONのパス]
jsc を並列で走らせる。結果はJSONで保存し、表は別で作る。
"""

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
GAMES = 200
OPENING = 4
LEVELS = list(range(1, 21))
PROXIES = ["Pgreedy", "PgreedyCorner"]


def run_one(a, b, seed):
    cmd = [JSC, os.path.join(HERE, "selfplay.js"), "--",
           "a=%s" % a, "b=%s" % b, "games=%d" % GAMES,
           "seed=%d" % seed, "opening=%d" % OPENING]
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=HERE)
    if out.returncode != 0:
        raise RuntimeError("jsc failed: %s\n%s\n%s" % (cmd, out.stdout, out.stderr))
    return json.loads(out.stdout.strip().splitlines()[-1])


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "p3_result.json")

    jobs = []
    # P3(a) 隣り合う段。a = 上の段 → aScore が上の段の勝率
    for n in range(1, 20):
        jobs.append(("pair", "L%d" % (n + 1), "L%d" % n, 100 + n))
    # P3(b) 各段 対 子ども代理。a = 代理 → aScore が代理の勝率
    # 代理2種には別々の種を割り当てる（同じ種だと出だしの4手が同じになり、
    # 「2種の代理で確かめた」が独立な2回の確認にならない＝検算役の指摘・2026-09-21）
    for pi, px in enumerate(PROXIES):
        for n in LEVELS:
            jobs.append(("proxy", px, "L%d" % n, 500 + pi * 1000 + n))

    results = []
    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [(kind, ex.submit(run_one, a, b, seed)) for kind, a, b, seed in jobs]
        for kind, f in futs:
            r = f.result()
            r["kind"] = kind
            results.append(r)
            print("%-7s %-14s vs %-14s  a勝率 %.3f  (%d勝 %d敗 %d分)  %dms"
                  % (kind, r["a"], r["b"], r["aScore"], r["aWin"], r["bWin"],
                     r["draw"], r["ms"]), flush=True)

    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({"games": GAMES, "opening": OPENING, "results": results}, fp,
                  ensure_ascii=False, indent=1)
    print("\n書き出し = %s" % dest)


if __name__ == "__main__":
    main()
