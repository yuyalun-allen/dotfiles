#!/bin/bash

# installation script for dotfiles
# 从任意目录运行均可（脚本自动定位仓库根目录）
set -u

DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

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

# clone <url> <dir>: 幂等克隆
clone() {
  git clone --depth=1 "$1" "$2" 2>/dev/null || true
}

# 1. Shell
clone https://github.com/basecamp/omarchy.git "$XDG_DATA_HOME/omarchy"
link "$DOTFILES_DIR/bash_profile" "$HOME/.bash_profile"
link "$DOTFILES_DIR/bashrc" "$HOME/.bashrc"
link "$DOTFILES_DIR/profile" "$HOME/.profile"

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
EOF

# 3. vim 插件（vendor pack 结构）
VIM_PLUGIN_START_HOME="$XDG_DATA_HOME/vim/pack/vendor/start"
VIM_PLUGIN_OPT_HOME="$XDG_DATA_HOME/vim/pack/vendor/opt"
mkdir -p "$VIM_PLUGIN_START_HOME" "$VIM_PLUGIN_OPT_HOME"

for repo in \
  https://github.com/NLKNguyen/papercolor-theme.git \
  https://github.com/prabirshrestha/vim-lsp.git \
  https://github.com/dense-analysis/ale.git \
  https://github.com/rhysd/vim-lsp-ale.git \
  https://github.com/prabirshrestha/asyncomplete.vim.git \
  https://github.com/prabirshrestha/asyncomplete-lsp.vim.git \
  https://github.com/airblade/vim-gitgutter.git \
  https://github.com/jasonccox/vim-wayland-clipboard.git \
  https://github.com/img-paste-devs/img-paste.vim.git \
  https://github.com/lervag/vimtex.git; do
  clone "$repo" "$VIM_PLUGIN_START_HOME/$(basename "$repo" .git)"
done
clone https://github.com/neoclide/coc.nvim.git "$VIM_PLUGIN_OPT_HOME/coc.nvim"

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
  if [ -d "$ext_dir/node_modules" ]; then
    echo "  ✓ $ext_name: node_modules 已存在，跳过"
  else
    echo "  Installing npm dependencies for $ext_name..."
    (cd "$ext_dir" && npm install --silent 2>/dev/null) || true
  fi
done

echo "Dotfiles successfully linked to XDG directories."
