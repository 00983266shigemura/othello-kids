#!/usr/bin/env python3
"""つよくなるオセロ ── 古いSafari（iOS 10.3.3）で動く書き方かを機械で見る（工程1）

2012年のiPadのSafariは新しい書き方（let/const/アロー/テンプレート文字列など）を
読み込んだ時点で止まる＝1文字でも混ざるとファイル全体が動かない（おかえりクエストの実測）。
実機へ載せるファイルだけを見る。Mac専用の台本は対象外。

使い方＝ python3 check_es5.py ファイル…
"""
import re
import sys

# (名前, 正規表現) ＝ 古いSafariで動かない書き方
BAD = [
    ("let 宣言", r"(?<![\w.$])let\s+[A-Za-z_$]"),
    ("const 宣言", r"(?<![\w.$])const\s+[A-Za-z_$]"),
    ("アロー関数 =>", r"=>"),
    ("テンプレート文字列 `", r"`"),
    ("class 宣言", r"(?<![\w.$])class\s+[A-Za-z_$]"),
    ("省略記法 ?.", r"\?\."),
    ("省略記法 ??", r"\?\?"),
    ("べき乗 **", r"[^*]\*\*[^*]"),
    ("for...of", r"(?<![\w.$])for\s*\([^)]*\sof\s"),
    ("分割代入 {a} =", r"(?<![\w.$])(var|let|const)\s*[\{\[]"),
    ("Object.assign", r"Object\.assign"),
    ("Array.from", r"Array\.from"),
    ("includes(", r"\.includes\s*\("),
    ("Promise", r"(?<![\w.$])Promise\b"),
    ("Symbol", r"(?<![\w.$])Symbol\b"),
]


def strip_noise(src):
    """文字列と注釈を空白に置き換える（そこに書かれた記号を拾わないため）"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r"[^\n]", " ", src[i:j]))
            i = j
        elif c == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append(" " * (j - i))
            i = j
        elif c in "'\"":
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == "\\" else 1
            j = min(j + 1, n)
            out.append(re.sub(r"[^\n]", " ", src[i:j]))
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def main():
    bad_total = 0
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as fp:
            raw = fp.read()
        src = strip_noise(raw)
        hits = []
        for name, pat in BAD:
            for m in re.finditer(pat, src):
                line = src.count("\n", 0, m.start()) + 1
                hits.append((line, name, raw.splitlines()[line - 1].strip()[:70]))
        hits.sort()
        if hits:
            bad_total += len(hits)
            print("✕ %s ＝ %d件" % (path, len(hits)))
            for line, name, text in hits:
                print("    %d行目  %s  ：%s" % (line, name, text))
        else:
            print("✓ %s ＝ 古い書き方だけ（%d行）" % (path, raw.count("\n") + 1))
    print("\n合計の引っかかり = %d件 → %s" % (bad_total, "PASS" if bad_total == 0 else "FAIL"))
    sys.exit(0 if bad_total == 0 else 1)


if __name__ == "__main__":
    main()
