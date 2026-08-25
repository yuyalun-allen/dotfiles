# =====================================================
# bash-game-menu.sh — 游戏化 bash 菜单
#
# 用法（在主 bashrc 中）：
#   1) 先 set -o vi
#   2) source 本文件（本文件已自包含菜单所需命令）
#
# 按键：
#   插入模式  -> ESC ESC 打开菜单（第一下正常退回命令模式）
#   命令模式  -> ESC 直接打开菜单（注意：命令模式下再按一下 ESC 会再次打开）
#
# 说明：下面先定义菜单用到的命令别名，再定义 menu()，
#       这样函数体里的别名才能在定义时正确展开。
# =====================================================

# 菜单用到的命令（从主 bashrc 移入，本文件自包含）
alias todo="pushd $HOME/Desktop/rule-book && vim TODO.md"
alias list="pushd $HOME/Desktop/rule-book && vim LIST.md"
alias show="pushd $HOME/Desktop/rule-book && vim SHOW.md"
alias memo="pushd $HOME/Desktop/rule-book && vim MEMO.md"

# 日记：在 rule-book 用日期创建/打开 Markdown（已有则直接打开）
diary() {
  local d="$HOME/Desktop/rule-book/diaries/$(date +%F).md"
  if [ ! -f "$d" ]; then
    printf '# %s\n\n' "$(date +%F)" > "$d"
    echo "已创建日记: $d"
  fi
  vim "$d"
}

# 查看日记：列出所有日记，选一个用 vim 打开
diaryview() {
  local dir="$HOME/Desktop/rule-book/diaries"
  local -a files=()
  # 用 glob + nullglob 取文件名，绕开 ls 别名（避免抓到长格式列头）
  shopt -s nullglob
  files=( "$dir"/????-??-??.md )
  shopt -u nullglob
  if [ "${#files[@]}" -eq 0 ]; then
    echo "还没有任何日记。"
    return 1
  fi
  # fzf 条目：仅日期（去 .md），按日期倒序（最近在上），右侧实时预览正文
  local -a entries=()
  local f
  for f in $(printf '%s\n' "${files[@]}" | sort -r); do
    entries+=("$(basename "$f" .md)")
  done
  local sel
  sel=$(printf '%s\n' "${entries[@]}" \
    | fzf --prompt="选择日记（回车打开，ESC 取消）: " \
          --header="日记列表（${#files[@]} 篇，最近在上，右侧实时预览）" \
          --preview '
            d={1}
            f="$HOME/Desktop/rule-book/diaries/$d.md"
            echo "=========== $d 日记 ==========="
            sed -n "1,40p" "$f"
          ' 2>/dev/null)
  [ -z "$sel" ] && { echo "已取消"; return; }
  vim "$dir/$sel.md"
}

# 新闻：生成/查看当天新闻摘要（rule-book/news/YYYY-MM-DD.md，缺失则先生成）
news() {
  local dir="$HOME/Desktop/rule-book/news"
  local -a entries=()
  local i d mark
  # 最近 7 天：今天在最前（fzf 默认光标停在第一行=最近一天）
  for i in $(seq 0 6); do
    d=$(date -d "$i days ago" +%F)
    if [ -f "$dir/$d.md" ]; then mark="✓"; else mark="·"; fi
    entries+=("$mark $d")
  done
  local sel
  sel=$(printf '%s\n' "${entries[@]}" \
    | fzf --prompt="选择日期（回车确认，ESC 取消）: " \
          --header="最近 7 天新闻（✓=已有 ·=缺失将生成，右侧实时预览）" \
          --preview '
            d={2}
            f="$HOME/Desktop/rule-book/news/$d.md"
            if [ -f "$f" ]; then
              echo "=========== $d 今日要闻 ==========="
              awk "/^## 今日要闻/{f=1;next} f&&/^##/{exit} f" "$f"
              echo
              echo "=========== 各源 ==========="
              grep -E "^### " "$f" | head -20
            else
              echo "【$d】暂无摘要，选择后自动生成"
            fi
          ' 2>/dev/null)
  [ -z "$sel" ] && { echo "已取消"; return; }
  local d="${sel##* }"
  local f="$dir/$d.md"
  if [ ! -f "$f" ]; then
    echo "【$d】无缓存，正在生成摘要..."
    summarize_news.sh "$d" || { echo "生成失败"; return 1; }
  fi
  vim "$f"
}

# 带旋转动效的单键读取；成功返回 0 并置 REPLY；^D/EOF 返回 1
_menu_getkey() {
  local spins=('->' '--') i=0 k
  # 在 menu() 已设好的规范模式下用 read -t 轮询，不再动 stty 原始模式，避免退出后泄漏
  printf '\r%s ' "${spins[0]}"
  while :; do
    if read -n 1 -t 0.2 k < /dev/tty 2>/dev/null; then
      printf '\r   \r'
      REPLY="$k"
      return 0
    fi
    i=$(( (i + 1) % ${#spins[@]} ))
    printf '\r%s ' "${spins[$i]}"          # 更新旋转箭头
  done
}

# 按显示宽度右补空格到目标列宽（中文等宽字符按 2 列计）
padw() {
  local s=$1 w=$2 i c cur=0
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    if [[ "$c" =~ [^\x00-\x7F] ]]; then ((cur += 2)); else ((cur += 1)); fi
  done
  printf '%s%*s' "$s" $(( w - cur )) ""
}

menu() {
  local saved reply
  saved=$(stty -g 2>/dev/null)
  stty icanon echo icrnl 2>/dev/null      # 临时规范模式：Enter(\r) 正常结束行

  while :; do
    clear
    echo "============ 菜单 ============"
    echo " $(padw '1) 当前任务' 14)2) 任务清单"
    echo " $(padw '3) 任务交付' 14)4) 地图"
    echo " $(padw '5) 系统监控' 14)6) 日记"
    echo " $(padw '7) 查看日记' 14)8) 新闻"
    echo " $(padw '9) 退出' 14)"
    if ! _menu_getkey; then
      # ^D / EOF：只关闭菜单，绝不把 EOF 传给 shell（否则会退出整个 bash）
      echo
      stty "$saved" 2>/dev/null
      return
    fi
    reply=$REPLY
    case "$reply" in
      1) todo ;;
      2) list ;;
      3) show ;;
      4) n ;;
      5) btop ;;
      6) diary ;;
      7) diaryview ;;
      8) news ;;
      9) break ;;
      -) neofetch ;;   # 隐藏彩蛋：按 - 显示 neofetch
      *) echo "无效选择"; continue ;;   # 无效输入留在菜单重选
    esac
    break   # 执行完任意有效选项后退出菜单（不再循环回菜单页）
  done
  stty "$saved" 2>/dev/null            # 退出时恢复终端设置（不用 trap，避免泄漏污染环境）
}

# 把 ESC 绑成菜单键（需已开启 vi mode）
bind -m vi-command -x '"\e": menu'
