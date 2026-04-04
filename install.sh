#!/bin/bash

# installation script for dotfiles
DOTFILES_DIR=$(pwd)
# assert DOTFILES_DIR is dotfiles
if [ ! -f "$DOTFILES_DIR/install.sh" ]; then
  echo "Error: This script must be run from the dotfiles directory."
  exit 1
fi

# 1. Configure XDG base directories
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# 2. Create XDG directories (if they don't exist)
mkdir -p "$XDG_CONFIG_HOME"
mkdir -p "$XDG_DATA_HOME"

# 3. Shell
# use omarchy's bash settings
git clone --depth=1 https://github.com/basecamp/omarchy.git "$XDG_DATA_HOME/omarchy"
ln -sf "$DOTFILES_DIR/bash_profile" "$HOME/.bash_profile"
ln -sf "$DOTFILES_DIR/bashrc" "$HOME/.bashrc"
ln -sf "$DOTFILES_DIR/profile" "$HOME/.profile"

# 4. environment settings

# fonts
mkdir -p "$XDG_CONFIG_HOME/fonts"
ln -sf "$DOTFILES_DIR/env/fonts/fonts.conf" "$XDG_CONFIG_HOME/fontconfig/fonts.conf"

# general env
mkdir -p "$XDG_CONFIG_HOME/environment.d"
ln -sf "$DOTFILES_DIR/env/environment.d/general-env.conf" "$XDG_CONFIG_HOME/environment.d/general-env.conf"

# secret keys loader (from GNOME Keyring)
ln -sf "$DOTFILES_DIR/env/environment.d/load-secret-keys.sh" "$XDG_CONFIG_HOME/environment.d/load-secret-keys.sh"

# user systemd


# 5. tool settings

# maven
mkdir -p "$XDG_CONFIG_HOME/maven"
ln -sf "$DOTFILES_DIR/tools/maven/settings.xml" "$XDG_CONFIG_HOME/maven/settings.xml"


# git
mkdir -p "$XDG_CONFIG_HOME/git"
ln -sf "$DOTFILES_DIR/tools/git/config" "$XDG_CONFIG_HOME/git/config"
ln -sf "$DOTFILES_DIR/tools/git/gitignore_global" "$XDG_CONFIG_HOME/git/gitignore_global"

# kitty
mkdir -p "$XDG_CONFIG_HOME/kitty"
ln -sf "$DOTFILES_DIR/tools/kitty/kitty.conf" "$XDG_CONFIG_HOME/kitty/kitty.conf"


# tmux
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
git clone --depth=1 https://github.com/NLKNguyen/papercolor-theme.git
git clone --depth=1 https://github.com/prabirshrestha/vim-lsp.git
git clone --depth=1 https://github.com/dense-analysis/ale.git 
git clone --depth=1 https://github.com/rhysd/vim-lsp-ale.git
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete.vim.git
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete-lsp.vim.git
git clone --depth=1 https://github.com/airblade/vim-gitgutter.git
git clone --depth=1 https://github.com/jasonccox/vim-wayland-clipboard.git
git clone --depth=1 https://github.com/img-paste-devs/img-paste.vim.git
git clone --depth=1 https://github.com/lervag/vimtex.git
popd
pushd $VIM_PLUGIN_OPT_HOME
git clone --depth=1 https://github.com/neoclide/coc.nvim.git
popd

# vscode
mkdir -p "$XDG_CONFIG_HOME/Code/User"
ln -sf "$DOTFILES_DIR/vscode/settings.json" "$XDG_CONFIG_HOME/Code/User/settings.json"
ln -sf "$DOTFILES_DIR/vscode/code-flags.conf" "$XDG_CONFIG_HOME/code-flags.conf"

# pi coding agent
echo "Installing pi coding agent configuration..."
PI_AGENT_CONFIG="$XDG_CONFIG_HOME/pi/agent"

# Backup existing pi agent data (sessions are machine-specific)
BACKUP_DIR="$HOME/.pi-agent-backup.$(date +%Y%m%d%H%M%S)"
if [ -d "$PI_AGENT_CONFIG/sessions" ]; then
  echo "Backing up existing sessions to $BACKUP_DIR..."
  mkdir -p "$BACKUP_DIR"
  cp -r "$PI_AGENT_CONFIG/sessions" "$BACKUP_DIR/"
fi

# Remove existing directories that will be replaced by symlinks
rm -rf "$PI_AGENT_CONFIG/skills"

mkdir -p "$PI_AGENT_CONFIG"
mkdir -p "$PI_AGENT_CONFIG/extensions"  # Local extensions directory (not synced)
ln -sf "$DOTFILES_DIR/tools/pi/agent/settings.json" "$PI_AGENT_CONFIG/settings.json"
ln -sf "$DOTFILES_DIR/tools/pi/agent/APPEND_SYSTEM.md" "$PI_AGENT_CONFIG/APPEND_SYSTEM.md"
ln -sf "$DOTFILES_DIR/tools/pi/agent/skills" "$PI_AGENT_CONFIG/skills"

# Install pi packages from settings.json (includes pi-permission-system)
if command -v pi &> /dev/null && [ -f "$PI_AGENT_CONFIG/settings.json" ]; then
  echo "Installing pi packages from settings.json..."
  pi install --global "$(jq -r '.packages[]' "$PI_AGENT_CONFIG/settings.json" 2>/dev/null | tr '\n' ' ')" 2>/dev/null || true
fi

# Install custom-anthropic extension dependencies
CUSTOM_ANTHROPIC_EXT="$PI_AGENT_CONFIG/extensions/custom-anthropic"
if [ -f "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package.json" ]; then
  echo "Installing custom-anthropic extension..."
  mkdir -p "$CUSTOM_ANTHROPIC_EXT"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/index.ts" "$CUSTOM_ANTHROPIC_EXT/index.ts"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package.json" "$CUSTOM_ANTHROPIC_EXT/package.json"
  ln -sf "$DOTFILES_DIR/tools/pi/agent/extensions/custom-anthropic/package-lock.json" "$CUSTOM_ANTHROPIC_EXT/package-lock.json"
  
  # Install npm dependencies
  if command -v npm &> /dev/null; then
    echo "Installing custom-anthropic npm dependencies..."
    (cd "$CUSTOM_ANTHROPIC_EXT" && npm install --silent 2>/dev/null) || true
  fi
fi


echo "Dotfiles successfully linked to XDG directories."
