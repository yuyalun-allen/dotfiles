#!/bin/bash

# installation script for dotfiles
# 从任意目录运行均可（脚本自动定位仓库根目录）
set -u

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# 参数：--update/-u —— 对已克隆的仓库执行 git pull、对已装依赖的扩展重跑 npm install
UPDATE=0
case "${1:-}" in
  --update|-u|update) UPDATE=1 ;;
esac

# link <src> <dest>: 创建/刷新软链，自动建父目录，跳过缺失源，防断链
link() {
  local src="$1" dest="$2"
  if [ ! -e "$src" ] && [ ! -L "$src" ]; then
    echo "  ✗ 跳过: $src 不存在"
    return
  fi
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"          # 清理旧软链/目录残留
  ln -sfn "$src" "$dest"
  echo "  ✓ $dest"
}

# clone <url> <dir>: 幂等克隆；--update 时对已存在仓库执行 git pull
clone() {
  local repo="$1" dir="$2" name
  name="$(basename "$dir")"
  if [ -d "$dir/.git" ]; then
    if [ "$UPDATE" = "1" ]; then
      echo "  ↻ 更新 $name"
      git -C "$dir" pull --ff-only 2>/dev/null \
        && git -C "$dir" fetch --depth=1 2>/dev/null \
        || echo "  ✗ $name 更新失败"
    else
      echo "  ✓ $name 已存在"
    fi
    return
  fi
  git clone --depth=1 "$repo" "$dir" 2>/dev/null \
    || echo "  ✗ 克隆 $name 失败"
}

# 1. Shell
clone https://github.com/basecamp/omarchy.git "$XDG_DATA_HOME/omarchy"
link "$DOTFILES_DIR/tools/bash/bash_profile" "$HOME/.bash_profile"
link "$DOTFILES_DIR/tools/bash/bashrc" "$HOME/.bashrc"
link "$DOTFILES_DIR/tools/bash/profile" "$HOME/.profile"

# 2. env / tool 配置软链（每行: 仓库相对路径|目标绝对路径）
while IFS='|' read -r rel dest; do
  [ -z "$rel" ] && continue
  link "$DOTFILES_DIR/$rel" "$dest"
done <<EOF
env/fonts/fonts.conf|$XDG_CONFIG_HOME/fontconfig/fonts.conf
env/environment.d/general-env.conf|$XDG_CONFIG_HOME/environment.d/general-env.conf
tools/maven/settings.xml|$XDG_CONFIG_HOME/maven/settings.xml
tools/git/config|$XDG_CONFIG_HOME/git/config
tools/git/gitignore_global|$XDG_CONFIG_HOME/git/gitignore_global
tools/kitty/kitty.conf|$XDG_CONFIG_HOME/kitty/kitty.conf
tools/tmux/tmux.conf|$XDG_CONFIG_HOME/tmux/tmux.conf
tools/vim/vimrc|$XDG_CONFIG_HOME/vim/vimrc
tools/vim/coc-settings.json|$XDG_CONFIG_HOME/vim/coc-settings.json
tools/vscode/settings.json|$XDG_CONFIG_HOME/Code/User/settings.json
tools/vscode/code-flags.conf|$XDG_CONFIG_HOME/code-flags.conf
# bin 脚本（~/.local/bin 下，经软链指向仓库 bin/）
bin/summarize_news.sh|$HOME/.local/bin/summarize_news.sh
bin/summarize_news.py|$HOME/.local/bin/summarize_news.py
bin/yt_feed.py|$HOME/.local/bin/yt_feed.py
bin/bili_feed.py|$HOME/.local/bin/bili_feed.py
EOF

# 3. vim 插件（vendor pack 结构）
# LSP 已从 vim-lsp 生态迁移到 coc.nvim（见 tools/vim/vimrc 的 LSP settings 段）
VIM_PLUGIN_START_HOME="$XDG_DATA_HOME/vim/pack/vendor/start"
VIM_PLUGIN_OPT_HOME="$XDG_DATA_HOME/vim/pack/vendor/opt"  # 已废弃（coc 移入 start），仅用于清理旧目录
mkdir -p "$VIM_PLUGIN_START_HOME"

for repo in \
  https://github.com/NLKNguyen/papercolor-theme.git \
  https://github.com/dense-analysis/ale.git \
  https://github.com/airblade/vim-gitgutter.git \
  https://github.com/img-paste-devs/img-paste.vim.git \
  https://github.com/lervag/vimtex.git \
  https://github.com/liuchengxu/vim-clap.git \
  https://github.com/neoclide/coc.nvim.git; do
  clone "$repo" "$VIM_PLUGIN_START_HOME/$(basename "$repo" .git)"
done

# 清理已废弃的 vim-lsp 生态插件目录（旧安装残留；ale 保留）
for stale in vim-lsp vim-lsp-ale asyncomplete.vim asyncomplete-lsp.vim; do
  if [ -d "$VIM_PLUGIN_START_HOME/$stale" ]; then
    rm -rf "$VIM_PLUGIN_START_HOME/$stale"
    echo "  ✓ 移除废弃插件: $stale"
  fi
done
rm -rf "$VIM_PLUGIN_OPT_HOME" 2>/dev/null || true

# 3.5 vim-clap 专用步骤：安装必须的 Rust 二进制 maple
# 官方文档: "the Rust binary maple is a must-have for ensuring smooth and optimal functionality"
# 方式: 先尝试下载预编译二进制（install.sh），失败则用 cargo 本地编译
VIM_CLAP_DIR="$VIM_PLUGIN_START_HOME/vim-clap"
if [ -d "$VIM_CLAP_DIR" ]; then
  if [ -x "$VIM_CLAP_DIR/bin/maple" ]; then
    echo "  ✓ vim-clap: maple 二进制已存在"
  else
    echo "  Installing vim-clap maple binary..."
    if (cd "$VIM_CLAP_DIR" && bash install.sh); then
      echo "  ✓ vim-clap: maple 预编译二进制安装完成"
    elif (cd "$VIM_CLAP_DIR" && cargo build --release && mkdir -p bin && cp target/release/maple bin/maple); then
      echo "  ✓ vim-clap: maple 由 cargo 编译完成"
    else
      echo "  ✗ vim-clap: maple 安装失败，请在 vim 中运行 :Clap install-binary"
    fi
  fi
else
  echo "  ✗ vim-clap 未成功克隆，跳过 maple 安装"
fi

# vim-clap 需要 Python 3 支持（Vim 需 +python3 编译；Neovim 需 pynvim）
if command -v vim >/dev/null 2>&1 && ! vim --version | grep -q '+python3'; then
  echo "  ⚠ 提示: vim 缺少 +python3 支持，vim-clap 的部分 provider 不可用"
fi

# 4. pi coding agent
PI_AGENT_CONFIG="$XDG_CONFIG_HOME/pi/agent"
mkdir -p "$PI_AGENT_CONFIG"
link "$DOTFILES_DIR/tools/pi/agent/settings.json" "$PI_AGENT_CONFIG/settings.json"
link "$DOTFILES_DIR/tools/pi/agent/APPEND_SYSTEM.md" "$PI_AGENT_CONFIG/APPEND_SYSTEM.md"
link "$DOTFILES_DIR/tools/pi/agent/models.json" "$PI_AGENT_CONFIG/models.json"
link "$DOTFILES_DIR/tools/pi/agent/skills" "$PI_AGENT_CONFIG/skills"
link "$DOTFILES_DIR/tools/pi/agent/extensions" "$PI_AGENT_CONFIG/extensions"

# npm install for all extensions (含 package.json 的子目录)
for ext_dir in "$PI_AGENT_CONFIG"/extensions/*/; do
  [ -d "$ext_dir" ] || continue
  [ -f "$ext_dir/package.json" ] || continue
  ext_name="$(basename "$ext_dir")"
  if [ -d "$ext_dir/node_modules" ] && [ "$UPDATE" != "1" ]; then
    echo "  ✓ $ext_name: node_modules 已存在，跳过"
  else
    act="$([ "$UPDATE" = "1" ] && echo '↻ 更新' || echo 'Installing')"
    echo "  $act npm deps for $ext_name..."
    (cd "$ext_dir" && npm install --silent 2>/dev/null) || true
  fi
done

echo "Dotfiles successfully linked to XDG directories."
