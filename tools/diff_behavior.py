#!/usr/bin/env python3
"""作り替える前と後の「動きの写し」を突き合わせる（工程2）。

使い方 ＝ python3 tools/diff_behavior.py tools/behavior_before.json tools/behavior_after.json
終了コード ＝ 0（1つも違わない） / 1（違いがある）
"""
import json
import sys


def main():
    if len(sys.argv) != 3:
        sys.exit('使い方: diff_behavior.py <前> <後>')
    a = json.load(open(sys.argv[1], encoding='utf-8'))
    b = json.load(open(sys.argv[2], encoding='utf-8'))

    if a['games'] != b['games']:
        sys.exit('局数が違う: %d と %d' % (a['games'], b['games']))

    bad = []
    for i, (ra, rb) in enumerate(zip(a['rows'], b['rows'])):
        for key in ('pair', 'seed', 'winner', 'black', 'white', 'plies', 'moves'):
            if ra[key] != rb[key]:
                bad.append('%d局目（%s・種%d）の %s が違う' % (i + 1, ra['pair'], ra['seed'], key))
        if json.dumps(ra['judge'], sort_keys=True) != json.dumps(rb['judge'], sort_keys=True):
            bad.append('%d局目（%s・種%d）の 採点の結果が違う\n    前=%s\n    後=%s'
                       % (i + 1, ra['pair'], ra['seed'],
                          json.dumps(ra['judge'], ensure_ascii=False, sort_keys=True),
                          json.dumps(rb['judge'], ensure_ascii=False, sort_keys=True)))

    if bad:
        print('✕ 違いが %d件' % len(bad))
        for line in bad[:40]:
            print('    ' + line)
        if len(bad) > 40:
            print('    …ほか %d件' % (len(bad) - 40))
        print('\n動きの一致 = FAIL')
        sys.exit(1)

    print('✓ %d局すべてで 棋譜・勝敗・石数・採点の結果が完全に一致' % a['games'])
    print('\n動きの一致 = PASS')


if __name__ == '__main__':
    main()
