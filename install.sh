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

echo "Dotfiles successfully linked to XDG directories."
