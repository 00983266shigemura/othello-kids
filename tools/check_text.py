#!/usr/bin/env python3
"""つよくなるオセロ ── 画面に出る ことば の機械検査（判定述語P7）

見るもの＝ index.html の「注釈を取りのぞいた残り」。
  注釈（/* */・//・<!-- -->）は 画面に出ないので 漢字があってよい。
  それ以外＝HTMLの文・CSS・JSの文字列＝すべて画面に出うる＝ここに漢字があってはいけない。
  この見かたなら、ことばを どこに書いても（text.js でも blunder.js でも ui.js でも）
  検査から もれない。

①漢字ゼロ＝合格の条件（設計書4.7章・しげの要件「すべてひらがな・カタカナ」）。
  例外＝大人向けの管理画面の文（text.js の ADULT_TEXT_BEGIN〜END の1区間だけ・2026-09-24 しげ指示）
②絵文字＝許した符号位置だけを通す（default-deny）。
  2012年のiPad（iOS 10.3.3）に無い世代の絵文字は 豆腐（字が無い印）になるため。
  おかえりクエストでの実測＝U+1F9F9（Unicode 11.0）が実機で豆腐になった。
③ひらがな文の長さ＝1文50字を超えるものを しらせる（止めはしない・工程3で読む材料）

使い方 ＝ python3 tools/check_text.py [ファイル…]（既定＝index.html）
終了コード ＝ 0（合格） / 1（不合格）
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)

# 漢字＝CJK統合漢字・拡張A・繰り返し記号
KANJI = re.compile(u'[々〇〻㐀-䶿一-鿿豈-﫿]')

# 大人向けの管理画面の文を はさむ 目じるし（text.js）
ADULT_BEGIN = '/*ADULT_TEXT_BEGIN*/'
ADULT_END = '/*ADULT_TEXT_END*/'

# 許した符号位置だけを通す。世代は Unicode の版。実機で見えた実績をコメントに残す。
ALLOW = {
    0x2713: u'✓ Unicode1.1（記号・絵文字ではない）',
    0x2715: u'✕ Unicode1.1（記号・絵文字ではない）',
    0x25cf: u'● Unicode1.1（記号）',
    0x25cb: u'○ Unicode1.1（記号）',
    0x2026: u'… Unicode1.1（記号）',
    0xff01: u'！ Unicode1.1（全角の記号）',
}

# 絵文字が住んでいる帯。ここに入る字は ALLOW に無いかぎり不合格にする
EMOJI_RANGES = [
    (0x1f000, 0x1ffff),   # 絵文字の本体（Unicode 6.0 以降）
    (0x2600, 0x27bf),     # 記号と絵文字のまじる帯
    (0x2b00, 0x2bff),
    (0x1f1e6, 0x1f1ff),   # 国旗
    (0xfe0f, 0xfe0f),     # 絵文字にする指示（異体字セレクタ）
]


def strip_comments(src):
    """注釈だけを空白へ置きかえる（文字列は残す＝そこが画面に出る言葉だから）。
       行と桁がずれないよう、同じ長さの空白に置きかえる。"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith('<!--', i):
            j = src.find('-->', i + 4)
            j = n if j < 0 else j + 3
            out.append(re.sub(r'[^\n]', ' ', src[i:j]))
            i = j
        elif c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j]))
            i = j
        elif c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i))
            i = j
        elif c in '\'"':
            # 文字列は そのまま残す（中に /* があっても注釈ではない）
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            j = min(j + 1, n)
            out.append(src[i:j])
            i = j
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def in_emoji_range(cp):
    for lo, hi in EMOJI_RANGES:
        if lo <= cp <= hi:
            return True
    return False


def check(path):
    with open(path, encoding='utf-8') as fp:
        raw = fp.read()
    body = strip_comments(raw)
    lines = raw.splitlines()

    # 大人向けの管理画面の文（text.js の ADULT_TEXT_BEGIN〜END）だけは 漢字を許す
    # （2026-09-24 しげ指示「管理画面は普通に漢字も使って大人向けにして」）。
    # 目じるしが 1組ちょうど でないときは 不合格＝区間が 子の文まで 広がる事故を 止める
    nb, ne = raw.count(ADULT_BEGIN), raw.count(ADULT_END)
    adult_bad = 0
    adult_kanji = 0
    if nb or ne:
        a, b = raw.find(ADULT_BEGIN), raw.find(ADULT_END)
        if nb != 1 or ne != 1 or b < a:
            print('  ✕ 大人向けの区間の目じるしが 1組ちょうど ではありません（BEGIN %d・END %d）' % (nb, ne))
            adult_bad = 1
        else:
            seg = body[a:b]
            adult_kanji = len(KANJI.findall(seg))
            body = body[:a] + KANJI.sub(u'＿', seg) + body[b:]

    kanji_hits, emoji_hits = [], []
    for m in KANJI.finditer(body):
        line = body.count('\n', 0, m.start()) + 1
        kanji_hits.append((line, m.group(0), lines[line - 1].strip()[:64]))
    for idx, ch in enumerate(body):
        cp = ord(ch)
        if in_emoji_range(cp) and cp not in ALLOW:
            line = body.count('\n', 0, idx) + 1
            emoji_hits.append((line, ch, cp))

    print('── %s' % path)
    if kanji_hits:
        print('  ✕ 漢字が %d件' % len(kanji_hits))
        for line, ch, text in kanji_hits[:30]:
            print('      %d行目  「%s」  ：%s' % (line, ch, text))
        if len(kanji_hits) > 30:
            print('      …ほか %d件' % (len(kanji_hits) - 30))
    else:
        print('  ✓ 漢字ゼロ（子の画面）')
    if adult_kanji:
        print('  ・ 大人向けの管理画面の区間＝漢字 %d字（検査の外）' % adult_kanji)

    if emoji_hits:
        print('  ✕ 表に無い絵文字が %d件' % len(emoji_hits))
        for line, ch, cp in emoji_hits[:30]:
            print('      %d行目  U+%04X （%s）' % (line, cp, ch))
    else:
        print('  ✓ 絵文字は 表にあるものだけ（%d個を許可）' % len(ALLOW))

    # ひらがな文の長さ＝止めはしない しらせ
    longs = []
    for s in re.split(u'[。\n]', body):
        t = s.strip()
        # 山かっこ・波かっこ・引用符が混じる断片は「文」ではなく作りの行なので数えない
        if (len(t) > 50 and re.search(u'[぀-ゟ]', t)
                and not re.search(r'[<{\'"]', t)):
            longs.append(t[:60])
    if longs:
        print('  ！ 50字を超える文が %d件（止めません・工程3で読む材料）' % len(longs))
        for t in longs[:5]:
            print('      %s…' % t)

    return len(kanji_hits) + len(emoji_hits) + adult_bad


def main():
    paths = sys.argv[1:] or [os.path.join(REPO, 'index.html')]
    bad = 0
    for p in paths:
        bad += check(p)
    print('\nP7（画面の文字に漢字ゼロ・絵文字は許した世代だけ）= %s'
          % ('PASS' if bad == 0 else 'FAIL'))
    sys.exit(0 if bad == 0 else 1)


if __name__ == '__main__':
    main()
