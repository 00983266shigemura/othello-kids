#!/usr/bin/env python3
"""悪手の しきい値 を決めるための集計（工程1）

入力＝scan_threshold.js の出したJSON（複数可）
出す物＝損の分布と、しきい値の候補ごとの
  ①1局あたりの悪手の数 ②負けた局のうち理由を出せる割合
"""
import json
import sys


def pct(xs, q):
    if not xs:
        return None
    s = sorted(xs)
    i = min(len(s) - 1, max(0, int(round(q / 100.0 * (len(s) - 1)))))
    return s[i]


def main():
    mid, end, games = [], [], []
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as fp:
            d = json.load(fp)
        mid += d["midLoss"]
        end += d["endLoss"]
        games += d["perGame"]

    print("子の手の数  中盤=%d  終盤=%d   局数=%d" % (len(mid), len(end), len(games)))
    for name, xs in (("中盤の損", mid), ("終盤の損(石)", end)):
        qs = [50, 75, 90, 95, 97, 99]
        print("%s : " % name + "  ".join("p%d=%s" % (q, pct(xs, q)) for q in qs)
              + "  最大=%s" % (max(xs) if xs else "-"))

    lost = [g for g in games if g["lost"]]
    print("\n負けた局 = %d / %d" % (len(lost), len(games)))
    print("%8s %8s | %12s %14s %16s" % ("中盤しきい", "終盤しきい", "1局の悪手数",
                                        "負け局で理由あり", "全局で理由あり"))
    for m in (12, 16, 20, 24, 30, 40, 60):
        for e in (2, 3, 4):
            n_bl = [sum(1 for v in g["mid"] if v >= m) + sum(1 for v in g["end"] if v >= e)
                    for g in games]
            has_lost = sum(1 for g in lost
                           if any(v >= m for v in g["mid"]) or any(v >= e for v in g["end"]))
            has_all = sum(1 for g in games
                          if any(v >= m for v in g["mid"]) or any(v >= e for v in g["end"]))
            print("%8d %8d | %12.2f %13.0f%% %15.0f%%"
                  % (m, e, sum(n_bl) / float(len(n_bl)),
                     100.0 * has_lost / max(1, len(lost)),
                     100.0 * has_all / len(games)))


if __name__ == "__main__":
    main()
