#!/usr/bin/env python3
"""つよくなるオセロ ── P4の試験用の棋譜を凍結する（工程1）

期待する理由（expect）は、CCが make_fixtures.js の出した盤の絵と「事実」の行を
1本ずつ読んで決めた。判定器の出した型（judged）はここでは使わない＝
一致するかどうかは test_blunder.js が別に測る。

使い方＝ python3 freeze_fixtures.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (もとのファイル, そのファイルの中で何本目か, 種, 名前, CCが決めた期待する理由)
PLAN = [
    ("fixtures_raw2.txt", 0, 314159, "かどa1が とれたのに となりの a2へ うった", "noCorner"),
    ("fixtures_raw2.txt", 1, 314176, "あきかどh1の となり g2へ うった", "nextToCorner"),
    ("fixtures_raw2.txt", 2, 314193, "あきかどh8の となり g7へ うった", "nextToCorner"),
    ("fixtures_raw2.txt", 3, 314210, "b8の あと おける所が2に へった", "lostMobility"),
    ("fixtures_raw2.txt", 4, 314290, "36手目に c6へ うって そん（型なし）", "none"),
    ("fixtures_raw2.txt", 5, 314307, "あき12マスで b7に うって14石そん", "endCount"),
    ("fixtures_raw2.txt", 6, 314324, "b1で1枚だけ返して大そん（型なし）", "none"),
    ("fixtures_raw2.txt", 7, 314341, "h2で3枚返して そん（型なし）", "none"),
    ("fixtures_raw.txt", 8, 337916, "かどh1が とれたのに h2へ うった（しろ番）", "noCorner"),
    ("fixtures_raw.txt", 9, 337967, "あき7マスで26石そんを した（しろ番）", "endCount"),
    ("fx_noblunder.txt", 0, 314159, "じょうずな打ちて＝悪手なし", "NOBLUNDER"),
]
# gaveCorner / tookTooMany が見つかったら追記する
EXTRA_FILES = ["fx_rest.txt", "fx_rest2.txt", "fx_rest3.txt"]
EXTRA_EXPECT = {
    11079291: ("うまったかどの となり g1へ うって そん（型なし）", "none"),
    11079371: ("しきい値をこえる悪手が1つも無い局", "NOBLUNDER"),
    22095100: ("b6で b7を じぶんの色にして あいてに a8を あけた", "gaveCorner"),
}


def read_json_lines(path):
    out = []
    with open(path, encoding="utf-8") as fp:
        for line in fp:
            if line.startswith("JSON="):
                out.append(json.loads(line[5:]))
    return out


def main():
    cases = []
    cache = {}
    for fname, idx, seed, name, expect in PLAN:
        rows = cache.setdefault(fname, read_json_lines(os.path.join(HERE, fname)))
        r = rows[idx]
        assert r["seed"] == seed, "種が合わない %s[%d] = %s" % (fname, idx, r["seed"])
        cases.append({
            "name": name, "expect": expect, "childColor": r["childColor"],
            "src": {"file": fname, "index": idx, "seed": seed,
                    "child": r["child"], "opp": r["opp"]},
            "moves": r["moves"],
        })

    for fname in EXTRA_FILES:
        path = os.path.join(HERE, fname)
        if not os.path.exists(path):
            continue
        for r in read_json_lines(path):
            if r["seed"] in EXTRA_EXPECT:
                name, expect = EXTRA_EXPECT[r["seed"]]
                cases.append({
                    "name": name, "expect": expect, "childColor": r["childColor"],
                    "src": {"file": fname, "seed": r["seed"],
                            "child": r["child"], "opp": r["opp"]},
                    "moves": r["moves"],
                })

    dest = os.path.join(HERE, "fixtures_p4.json")
    with open(dest, "w", encoding="utf-8") as fp:
        json.dump({
            "note": "期待する理由は、盤の絵と事実の行をCCが1本ずつ読んで決めたもの。"
                    "判定器の出力は使っていない。",
            "cases": cases}, fp, ensure_ascii=False, indent=1)
    print("凍結 = %d本 → %s" % (len(cases), dest))
    for c in cases:
        print("  %-36s 期待=%s" % (c["name"], c["expect"]))


if __name__ == "__main__":
    main()
