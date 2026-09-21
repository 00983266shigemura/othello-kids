# ===== 回収プロローグ（ここから・変更しない）=====
# 実行のたびに番号を採る（秒まで）。貼り直しによる同じ秒の二重実行は止まる。
RUN_ID="othello_$(date +%Y%m%d_%H%M%S)"
LOG_DIR="/Users/shigemurasatoshi/dev/othello-kids/logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/run_${RUN_ID}.log"

setopt noclobber
if ! { : > "$LOG" } 2>/dev/null; then
  if [[ -e "$LOG" ]]; then
    print -u2 "この台本は実行済みです（run_id=${RUN_ID}）。二重実行を防ぐため何もせず終了します。"
    exit 0
  else
    print -u2 "ログを作成できません（保存先フォルダが無い等）。何も実行せず終了します: ${LOG}"
    exit 78
  fi
fi
unsetopt noclobber

exec 3>&1 4>&2
exec > >(tee -a "$LOG") 2>&1
trap 'rc=$?; exec 1>&3 2>&4; sleep 0.3; print -r -- "END run_id=${RUN_ID} exit=${rc}" >> "$LOG"' EXIT
print -r -- "BEGIN run_id=${RUN_ID}"
# ===== 回収プロローグ（ここまで）。以下に本処理を書く =====

GIT="/usr/bin/git"
REPO_DIR="/Users/shigemurasatoshi/dev/othello-kids"
ORIGIN_URL="https://github.com/00983266shigemura/othello-kids.git"
PAGES_URL="https://00983266shigemura.github.io/othello-kids/"

print "== 1/5 ページが部品どおりか（手で直した跡が無いか）を機械で見る =="
/usr/bin/python3 "${REPO_DIR}/tools/build_app.py" > /dev/null
if [ $? -ne 0 ]; then
  print "組み立てに失敗しました。何も公開していません。CCへ知らせてください。"
  exit 1
fi
DIRTY=$("$GIT" -C "$REPO_DIR" status --porcelain)
if [ -n "$DIRTY" ]; then
  print "部品と ページ が食い違っています（または未保存の直しがあります）。"
  print "安全のため公開を中止しました。次の行をCCへ貼ってください。"
  print "----"
  print -r -- "$DIRTY"
  print "----"
  exit 1
fi
print "一致しています（正常）"

print "== 2/5 公開先の登録を確かめる =="
if "$GIT" -C "$REPO_DIR" remote get-url origin > /dev/null 2>&1; then
  NOW=$("$GIT" -C "$REPO_DIR" remote get-url origin)
  print "登録ずみ = ${NOW}"
else
  "$GIT" -C "$REPO_DIR" remote add origin "$ORIGIN_URL"
  if [ $? -ne 0 ]; then
    print "公開先を登録できませんでした。CCへ知らせてください。"
    exit 1
  fi
  print "登録しました = ${ORIGIN_URL}"
fi

print "== 3/5 公開へ反映（push） =="
"$GIT" -C "$REPO_DIR" push -u origin main
if [ $? -ne 0 ]; then
  print ""
  print "反映に失敗しました。よくある原因は2つです。"
  print " ① GitHub に othello-kids の置き場をまだ作っていない"
  print "    → ブラウザで作ってから、この台本をもう一度実行してください"
  print " ② 置き場の名前や所有者がちがう"
  print "    → 上の行をそのままCCへ貼ってください"
  exit 1
fi

print "== 4/5 反映されたか確かめる =="
"$GIT" -C "$REPO_DIR" fetch origin main
LOCAL=$("$GIT" -C "$REPO_DIR" rev-parse HEAD)
REMOTE=$("$GIT" -C "$REPO_DIR" rev-parse origin/main)
print "手元   = ${LOCAL}"
print "公開先 = ${REMOTE}"
if [ "$LOCAL" != "$REMOTE" ]; then
  print "一致しません。反映しきれていない可能性があります。CCへ知らせてください。"
  exit 1
fi

print "== 5/5 iPadで開く場所 =="
print "${PAGES_URL}"
print ""
print "※ この場所が出るまで、GitHub側で1〜2分かかることがあります。"
print "※ 最初の1回だけ、GitHubの Settings → Pages で「main / (root)」を選ぶ必要があります。"

print "== 完了：合格 =="
exit 0
