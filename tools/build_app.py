#!/usr/bin/env python3
"""つよくなるオセロ ── index.html を1枚に組み立てる唯一の道具（工程2）。

なぜこの道具しか無いか＝
  中身（core.js / ai.js / blunder.js / rules.js / text.js / ui.js）を1か所だけに置き、
  Mac の試験台本と、iPad で動くページが「同じ中身」であることを機械で保証するため。
  手でコピーして貼る道を残すと、片方だけ直したときに気づけない。

  試験用・目視用の複製は --silent で作る。無音化が この道に焼き込んであるので、
  「テストで音を鳴らさない」（2026-09-16 しげ指示）を忘れようがない。

使い方 ＝
  python3 tools/build_app.py                      ← 本番の index.html と version.txt
  python3 tools/build_app.py --silent _test.html  ← 音の鳴らない複製（試験・目視用）
  python3 tools/build_app.py --selftest           ← 無音化の目印の検査そのものを試す

終了コード ＝ 0（できた） / 1（できなかった）
"""
import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
TPL = os.path.join(HERE, 'app_template.html')
OUT = os.path.join(REPO, 'index.html')
VER = os.path.join(REPO, 'version.txt')

# 差し込む順＝先に読ませないと動かない順（core が いちばん先）
PARTS = [
    ('__CORE__', 'core.js'),
    ('__AI__', 'ai.js'),
    ('__BLUNDER__', 'blunder.js'),
    ('__RULES__', 'rules.js'),
    ('__TEXT__', 'text.js'),
    ('__UI__', 'ui.js'),
]

SILENCE_MARK = 'OTHELLO_SILENT_BUILD'

# 無音化の3段（mkpage.py と同じ考え方）＝
#   ①アプリの音は すべて OKUI.ensureAudio() を通る。ここを塞げば あとで足した音も鳴らない
#   ②音の入口そのもの（AudioContext）を「使うと失敗する」形へ差し替える＝
#     ensureAudio を通らない書き方が現れたら、黙って鳴るのではなく 目に見えて失敗する
#   ③このページは動画の枠を持たないので、別ドメインから出る音は無い
SILENCE_JS = """/* %s ＝ 音の鳴らない複製（試験・目視用）。build_app.py --silent だけが作る */
(function () {
  'use strict';
  OKUI.ensureAudio = function () { return null; };
  function Dead() { throw new Error('%s: 音の入口は塞いであります'); }
  try { window.AudioContext = Dead; } catch (e) {}
  try { window.webkitAudioContext = Dead; } catch (e2) {}
})();""" % (SILENCE_MARK, SILENCE_MARK)


def read(path):
    with open(path, encoding='utf-8') as fp:
        return fp.read()


def check_es5(paths):
    """古いSafariで動かない書き方が混ざっていないか、組み立てる前に見る"""
    cmd = [sys.executable, os.path.join(HERE, 'check_es5.py')] + paths
    r = subprocess.run(cmd, capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        sys.stdout.write(r.stderr)
        sys.exit('ES5 でない書き方があるので 組み立てを止めました')


def app_version(ui_src):
    m = re.search(r'OKUI\.APP_VERSION\s*=\s*(\d+)\s*;', ui_src)
    if not m:
        sys.exit('ui.js に OKUI.APP_VERSION が見つかりません')
    return int(m.group(1))


def build(silent):
    tpl = read(TPL)
    srcs = {}
    for mark, name in PARTS:
        srcs[mark] = read(os.path.join(HERE, name))

    check_es5([os.path.join(HERE, name) for _, name in PARTS])

    ver = app_version(srcs['__UI__'])
    html = tpl
    for mark, _ in PARTS:
        needle = '/*%s*/' % mark
        if needle not in html:
            sys.exit('ひな型に %s がありません' % needle)
        html = html.replace(needle, srcs[mark])
    html = html.replace('/*__SILENCE__*/', SILENCE_JS if silent else '')
    return html, ver


def verify_silence(html):
    """作った複製に 無音化の目印が入っているか。無ければ書かずに止める"""
    if SILENCE_MARK not in html:
        return '無音化の目印（%s）が入っていません' % SILENCE_MARK
    if 'OKUI.ensureAudio = function () { return null; }' not in html:
        return '音の入口を塞ぐ1行が入っていません'
    return ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--silent', metavar='ファイル', default=None,
                    help='音の鳴らない複製を この場所へ書く（試験・目視用）')
    ap.add_argument('--selftest', action='store_true',
                    help='無音化の検査そのものが ちゃんと落ちるかを試す')
    args = ap.parse_args()

    if args.selftest:
        html, _ = build(True)
        if verify_silence(html) != '':
            sys.exit('自己試験：無音の版が 検査に落ちました＝検査か組み立てが壊れています')
        broken = html.replace(SILENCE_MARK, 'XXXX')
        if verify_silence(broken) == '':
            sys.exit('自己試験：目印を抜いたのに 検査が通りました＝検査が効いていません')
        print('✓ 無音化の検査は ちゃんと効いています')
        return

    if args.silent:
        html, ver = build(True)
        bad = verify_silence(html)
        if bad:
            sys.exit('書きませんでした＝' + bad)
        path = args.silent if os.path.isabs(args.silent) else os.path.join(REPO, args.silent)
        with open(path, 'w', encoding='utf-8') as fp:
            fp.write(html)
        print('できました（音は鳴りません）＝ %s（%d バイト・はんすう %d）'
              % (path, len(html.encode('utf-8')), ver))
        return

    html, ver = build(False)
    if SILENCE_MARK in html:
        sys.exit('本番のページに 無音化が混ざっています＝書きませんでした')
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write(html)
    with open(VER, 'w', encoding='utf-8') as fp:
        fp.write('%d\n' % ver)
    print('できました ＝ %s（%d バイト）' % (OUT, len(html.encode('utf-8'))))
    print('はんすう ＝ %d（%s に書きました）' % (ver, VER))


if __name__ == '__main__':
    main()
