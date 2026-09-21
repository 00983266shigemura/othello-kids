#!/usr/bin/env python3
"""make_fixtures.js の出力ファイルにある JSON= 行を一覧にする（凍結の前の確認用）"""
import json
import sys

for path in sys.argv[1:]:
    print("== " + path)
    i = 0
    with open(path, encoding="utf-8") as fp:
        for line in fp:
            if not line.startswith("JSON="):
                continue
            d = json.loads(line[5:])
            print("  %2d  seed=%d  判定=%-13s child=%-13s 色=%d ply=%d sq=%d 手数合計=%d"
                  % (i, d["seed"], d["judged"], d["child"], d["childColor"],
                     d["ply"], d["sq"], len(d["moves"])))
            i += 1
