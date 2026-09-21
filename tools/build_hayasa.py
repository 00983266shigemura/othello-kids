#!/usr/bin/env python3
"""はやさ はかり ページを1枚に組み立てる（core.js を差し込むだけ）。

使い方 ＝ python3 /Users/shigemurasatoshi/dev/othello-kids/tools/build_hayasa.py
出来る物 ＝ /Users/shigemurasatoshi/dev/othello-kids/hayasa/index.html（1ファイル完結）
理由 ＝ 中身（core.js）を1か所だけに置き、Mac の測定台本とページで同じ計算を使う。
"""
import os
import re
import sys

ROOT = '/Users/shigemurasatoshi/dev/othello-kids'
CORE = os.path.join(ROOT, 'tools', 'core.js')
TPL = os.path.join(ROOT, 'tools', 'hayasa_template.html')
OUT_DIR = os.path.join(ROOT, 'hayasa')
OUT = os.path.join(OUT_DIR, 'index.html')

core = open(CORE, encoding='utf-8').read()
tpl = open(TPL, encoding='utf-8').read()

if '/*__CORE__*/' not in tpl:
    sys.exit('ひな型に /*__CORE__*/ がありません')

# Safari 10.1 で動かない書き方が混ざっていないか、組み立てる前に止める
NG = [
    (r'(?<![\w$.])let\s', 'let'),
    (r'(?<![\w$.])const\s', 'const'),
    (r'=>', 'アロー関数'),
    (r'(?<![\w$.])class\s', 'class'),
    (r'`', 'テンプレート文字列'),
    (r'\.\.\.', 'スプレッド'),
    (r'(?<![\w$.])Object\.assign', 'Object.assign'),
    (r'(?<![\w$.])Promise(?![\w$])', 'Promise'),
]
bad = []
for path, text in ((CORE, core), (TPL, tpl)):
    body = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    body = re.sub(r'(?m)^\s*//.*$', '', body)
    for pat, name in NG:
        for m in re.finditer(pat, body):
            line = body[:m.start()].count('\n') + 1
            bad.append('%s の %d 行あたり ＝ %s' % (os.path.basename(path), line, name))
if bad:
    sys.exit('ES5 でない書き方が見つかりました:\n  ' + '\n  '.join(bad))

html = tpl.replace('/*__CORE__*/', core)
os.makedirs(OUT_DIR, exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(html)
print('できました ＝ %s（%d バイト）' % (OUT, len(html.encode('utf-8'))))
