#!/bin/bash

# installation script for dotfiles
DOTFILES_DIR=$(pwd)
if [ ! -f "$DOTFILES_DIR/install.sh" ]; then
  echo "Error: This script must be run from the dotfiles directory."
  exit 1
fi

# 1. Configure XDG base directories
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

mkdir -p "$XDG_CONFIG_HOME"
mkdir -p "$XDG_DATA_HOME"

# 2. Shell
git clone --depth=1 https://github.com/basecamp/omarchy.git "$XDG_DATA_HOME/omarchy" 2>/dev/null || true
ln -sf "$DOTFILES_DIR/bash_profile" "$HOME/.bash_profile"
ln -sf "$DOTFILES_DIR/bashrc" "$HOME/.bashrc"
ln -sf "$DOTFILES_DIR/profile" "$HOME/.profile"

# 3. environment settings
mkdir -p "$XDG_CONFIG_HOME/fonts"
ln -sf "$DOTFILES_DIR/env/fonts/fonts.conf" "$XDG_CONFIG_HOME/fontconfig/fonts.conf"
mkdir -p "$XDG_CONFIG_HOME/environment.d"
ln -sf "$DOTFILES_DIR/env/environment.d/general-env.conf" "$XDG_CONFIG_HOME/environment.d/general-env.conf"
ln -sf "$DOTFILES_DIR/env/environment.d/load-secret-keys.sh" "$XDG_CONFIG_HOME/environment.d/load-secret-keys.sh"

# 4. tool settings
mkdir -p "$XDG_CONFIG_HOME/maven"
ln -sf "$DOTFILES_DIR/tools/maven/settings.xml" "$XDG_CONFIG_HOME/maven/settings.xml"
mkdir -p "$XDG_CONFIG_HOME/git"
ln -sf "$DOTFILES_DIR/tools/git/config" "$XDG_CONFIG_HOME/git/config"
ln -sf "$DOTFILES_DIR/tools/git/gitignore_global" "$XDG_CONFIG_HOME/git/gitignore_global"
mkdir -p "$XDG_CONFIG_HOME/kitty"
ln -sf "$DOTFILES_DIR/tools/kitty/kitty.conf" "$XDG_CONFIG_HOME/kitty/kitty.conf"
mkdir -p "$XDG_CONFIG_HOME/tmux"
ln -sf "$DOTFILES_DIR/tools/tmux/tmux.conf" "$XDG_CONFIG_HOME/tmux/tmux.conf"

# vim
echo "Installing recommending vim plugins"
VIM_PLUGIN_START_HOME="$XDG_DATA_HOME/vim/pack/vendor/start"
VIM_PLUGIN_OPT_HOME="$XDG_DATA_HOME/vim/pack/vendor/opt"
mkdir -p "$XDG_CONFIG_HOME/vim"
mkdir -p $VIM_PLUGIN_START_HOME
mkdir -p $VIM_PLUGIN_OPT_HOME
ln -sf "$DOTFILES_DIR/tools/vim/vimrc" "$XDG_CONFIG_HOME/vim/vimrc"
ln -sf "$DOTFILES_DIR/tools/vim/coc-settings.json" "$XDG_CONFIG_HOME/vim/coc-settings.json"
pushd $VIM_PLUGIN_START_HOME
git clone --depth=1 https://github.com/NLKNguyen/papercolor-theme.git 2>/dev/null || true
git clone --depth=1 https://github.com/prabirshrestha/vim-lsp.git 2>/dev/null || true
git clone --depth=1 https://github.com/dense-analysis/ale.git 2>/dev/null || true
git clone --depth=1 https://github.com/rhysd/vim-lsp-ale.git 2>/dev/null || true
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete.vim.git 2>/dev/null || true
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete-lsp.vim.git 2>/dev/null || true
git clone --depth=1 https://github.com/airblade/vim-gitgutter.git 2>/dev/null || true
git clone --depth=1 https://github.com/jasonccox/vim-wayland-clipboard.git 2>/dev/null || true
git clone --depth=1 https://github.com/img-paste-devs/img-paste.vim.git 2>/dev/null || true
git clone --depth=1 https://github.com/lervag/vimtex.git 2>/dev/null || true
popd
pushd $VIM_PLUGIN_OPT_HOME
git clone --depth=1 https://github.com/neoclide/coc.nvim.git 2>/dev/null || true
popd

# vscode
mkdir -p "$XDG_CONFIG_HOME/Code/User"
ln -sf "$DOTFILES_DIR/vscode/settings.json" "$XDG_CONFIG_HOME/Code/User/settings.json"
ln -sf "$DOTFILES_DIR/vscode/code-flags.conf" "$XDG_CONFIG_HOME/code-flags.conf"

# pi coding agent
echo "Installing pi coding agent configuration..."
PI_AGENT_CONFIG="$XDG_CONFIG_HOME/pi/agent"
rm -rf "$PI_AGENT_CONFIG/skills"
mkdir -p "$PI_AGENT_CONFIG"
ln -sf "$DOTFILES_DIR/tools/pi/agent/settings.json" "$PI_AGENT_CONFIG/settings.json"
ln -sf "$DOTFILES_DIR/tools/pi/agent/APPEND_SYSTEM.md" "$PI_AGENT_CONFIG/APPEND_SYSTEM.md"
ln -sf "$DOTFILES_DIR/tools/pi/agent/skills" "$PI_AGENT_CONFIG/skills"
ln -sf "$DOTFILES_DIR/tools/pi/agent/pi-permissions.jsonc" "$PI_AGENT_CONFIG/pi-permissions.jsonc"

# Install extensions
echo "Installing extensions..."

# custom-anthropic (with npm dependencies)
CUSTOM_ANTHROPIC_EXT="$PI_AGENT_CONFIG/extensions/custom-anthropic"
if [ -f "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package.json" ]; then
  echo "  Installing custom-anthropic..."
  mkdir -p "$CUSTOM_ANTHROPIC_EXT"
  rm -f "$CUSTOM_ANTHROPIC_EXT"/*.ts "$CUSTOM_ANTHROPIC_EXT"/*.json 2>/dev/null
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/index.ts" "$CUSTOM_ANTHROPIC_EXT/index.ts"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package.json" "$CUSTOM_ANTHROPIC_EXT/package.json"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package-lock.json" "$CUSTOM_ANTHROPIC_EXT/package-lock.json"
  (cd "$CUSTOM_ANTHROPIC_EXT" && npm install --silent 2>/dev/null) || true
fi

# permission-gate (bash + write + edit confirmation)
PERMISSION_GATE_EXT="$PI_AGENT_CONFIG/extensions/permission-gate"
if [ -f "$DOTFILES_DIR/tools/pi/agent/extensions/permission-gate/index.ts" ]; then
  echo "  Installing permission-gate..."
  mkdir -p "$PERMISSION_GATE_EXT"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/permission-gate/index.ts" "$PERMISSION_GATE_EXT/index.ts"
fi

echo "Dotfiles successfully linked to XDG directories."
