#!/usr/bin/env python3
"""つよくなるオセロ ── ホーム画面の絵（icon.png）を作る唯一の道具。

なぜ道具で作るか＝
  手で描いた絵を置くと、色がアプリ本体とずれても誰も気づけない。
  ここでは app_template.html と同じ色の名札を使って描く＝ずれたら直す場所が1か所で済む。

絵の中身＝オセロの いちばん最初の並び（白・黒・黒・白）を のせた ばん。
  ①6歳が見て「オセロだ」と分かる いちばん短い説明である
  ②赤と緑の対比を使わない＝白黒に落としても 石の区別がつく（しげの色覚特性）
  ③文字を入れない＝iOSがアイコンの下に名前を出すので重複する

大きさ＝180×180。透明を持たない（RGB）。
  iOS 10 は透明部分を黒で塗りつぶすため、透明を持つ絵はふちが黒くにじむ。
  おかえりクエストの icon.png も 180×180・透明なし（実測）。

使い方 ＝
  python3 tools/make_icon.py          ← icon.png を作り直す
  python3 tools/make_icon.py --check  ← 作らずに、今ある icon.png を見るだけ

終了コード ＝ 0（できた） / 1（できなかった）
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'icon.png')

SIZE = 180          # iOSのホーム画面用。iPadはここから縮めて使う
SS = 8              # いったん8倍で描いて縮める＝ふちのギザギザを消す

# 色は app_template.html の名札と同じもの（--ryokuao / --ryokuao-dark / --kuro / --shiro）
BAN = (0x00, 0x9E, 0x73)        # ばん＝緑青
WAKU = (0x00, 0x65, 0x4a)       # ばんの ふちと ます目の線
KURO = (0x14, 0x14, 0x14)       # くろい いし
SHIRO = (0xfd, 0xfd, 0xfb)      # しろい いし

WAKU_W = 7                      # ばんの ふちの太さ（180のとき）
SEN_W = 5                       # ます目の線の太さ（180のとき）
ISHI_R = 31                     # いしの 半径（180のとき）


def draw():
    n = SIZE * SS
    im = Image.new('RGB', (n, n), BAN)
    d = ImageDraw.Draw(im)

    waku = WAKU_W * SS
    sen = SEN_W * SS

    # ばんの ふち
    d.rectangle([0, 0, n - 1, n - 1], outline=WAKU, width=waku)

    # ます目の線（まん中に たて1本・よこ1本＝2×2の ます）
    mid = n // 2
    d.rectangle([mid - sen // 2, waku, mid + sen // 2, n - waku], fill=WAKU)
    d.rectangle([waku, mid - sen // 2, n - waku, mid + sen // 2], fill=WAKU)

    # いし＝オセロの いちばん最初の並び（左上しろ・右上くろ・左下くろ・右下しろ）
    r = ISHI_R * SS
    inner0, inner1 = waku, n - waku
    q1 = inner0 + (inner1 - inner0) // 4
    q3 = inner0 + (inner1 - inner0) * 3 // 4
    naraba = [
        (q1, q1, SHIRO),
        (q3, q1, KURO),
        (q1, q3, KURO),
        (q3, q3, SHIRO),
    ]
    for cx, cy, iro in naraba:
        # ふちを ばんの色より濃くして、しろい いしが ばんに溶けないようにする
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=iro, outline=WAKU, width=2 * SS)

    return im.resize((SIZE, SIZE), Image.LANCZOS)


def look(path):
    """今ある絵を見るだけ＝大きさ・透明の有無・こわれていないか"""
    if not os.path.exists(path):
        return '絵がありません＝' + path
    try:
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            if im.size != (SIZE, SIZE):
                return '大きさが %s＝%d×%d でなければなりません' % (im.size, SIZE, SIZE)
            if im.mode != 'RGB':
                return '色の持ち方が %s＝RGB（透明なし）でなければなりません' % im.mode
    except Exception as e:
        return 'こわれています＝' + str(e)
    return ''


def main():
    if '--check' in sys.argv:
        bad = look(OUT)
        if bad:
            sys.exit('✕ ' + bad)
        print('✓ %s ＝ %d×%d・透明なし・こわれていない（%d バイト）'
              % (OUT, SIZE, SIZE, os.path.getsize(OUT)))
        return

    im = draw()
    im.save(OUT, 'PNG', optimize=True)

    # 書いたあと、もう一度 開いて確かめる＝
    # おかえりクエストで こわれた絵（中身の照合値が合わない）を配ってしまった事故があるため
    bad = look(OUT)
    if bad:
        sys.exit('書きましたが確かめに落ちました＝' + bad)
    print('できました ＝ %s（%d×%d・%d バイト）'
          % (OUT, SIZE, SIZE, os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
