#!/bin/bash

# 安装目录
DOTFILES_DIR=$(pwd)

# 1. 配置 XDG 目录
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"

# 2. 创建 XDG 目录（如果不存在）
mkdir -p "$XDG_CONFIG_HOME"
mkdir -p "$XDG_DATA_HOME"

# 3. 创建目标目录并创建软链接

# shell
ln -sf "$DOTFILES_DIR/bash_profile" "$HOME/.bash_profile"
ln -sf "$DOTFILES_DIR/bashrc" "$HOME/.bashrc"
ln -sf "$DOTFILES_DIR/profile" "$HOME/.profile"

# Applications/bin
mkdir -p "$HOME/Applications/bin"
ln -sf "$DOTFILES_DIR/Applications/bin/chat.py" "$HOME/Applications/bin/chat"

# fish
mkdir -p "$XDG_CONFIG_HOME/gdb"
ln -sf "$DOTFILES_DIR/gdb/gdbinit" "$XDG_CONFIG_HOME/gdb/gdbinit"

# fish
mkdir -p "$XDG_CONFIG_HOME/fish"
ln -sf "$DOTFILES_DIR/fish/config.fish" "$XDG_CONFIG_HOME/fish/config.fish"

# fonts
mkdir -p "$XDG_CONFIG_HOME/fonts"
ln -sf "$DOTFILES_DIR/fonts/fonts.conf" "$XDG_CONFIG_HOME/fonts/fonts.conf"

# general env
mkdir -p "$XDG_CONFIG_HOME/environment.d"
ln -sf "$DOTFILES_DIR/environment.d/general-env.conf" "$XDG_CONFIG_HOME/environment.d/general-env.conf"

# git
mkdir -p "$XDG_CONFIG_HOME/git"
ln -sf "$DOTFILES_DIR/git/config" "$XDG_CONFIG_HOME/git/config"

# hypr
mkdir -p "$XDG_CONFIG_HOME/hypr/scripts"
ln -sf "$DOTFILES_DIR/hypr/hyprland.conf" "$XDG_CONFIG_HOME/hypr/hyprland.conf"
ln -sf "$DOTFILES_DIR/hypr/hyprpaper.conf" "$XDG_CONFIG_HOME/hypr/hyprpaper.conf"
ln -sf "$DOTFILES_DIR/hypr/scripts/backlight" "$XDG_CONFIG_HOME/hypr/scripts/backlight"
ln -sf "$DOTFILES_DIR/hypr/scripts/volume" "$XDG_CONFIG_HOME/hypr/scripts/volume"

# kitty
mkdir -p "$XDG_CONFIG_HOME/kitty"
ln -sf "$DOTFILES_DIR/kitty/kitty.conf" "$XDG_CONFIG_HOME/kitty/kitty.conf"


# tmux
mkdir -p "$XDG_CONFIG_HOME/tmux"
ln -sf "$DOTFILES_DIR/tmux/tmux.conf" "$XDG_CONFIG_HOME/tmux/tmux.conf"

# vim
echo "Installing recommending vim plugins"
VIM_PLUGIN_HOME="$XDG_DATA_HOME/vim/pack/vendor/start"
mkdir -p "$XDG_CONFIG_HOME/vim"
mkdir -p $VIM_PLUGIN_HOME
ln -sf "$DOTFILES_DIR/vim/vimrc" "$XDG_CONFIG_HOME/vim/vimrc"
pushd $VIM_PLUGIN_HOME
git clone --depth=1 https://github.com/NLKNguyen/papercolor-theme.git
git clone --depth=1 https://github.com/prabirshrestha/vim-lsp.git
git clone --depth=1 https://github.com/dense-analysis/ale.git 
git clone --depth=1 https://github.com/rhysd/vim-lsp-ale.git
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete.vim.git
git clone --depth=1 https://github.com/prabirshrestha/asyncomplete-lsp.vim.git
git clone --depth=1 https://github.com/airblade/vim-gitgutter.git
popd

# waybar
mkdir -p "$XDG_CONFIG_HOME/waybar"
ln -sf "$DOTFILES_DIR/waybar/config" "$XDG_CONFIG_HOME/waybar/config"
ln -sf "$DOTFILES_DIR/waybar/style.css" "$XDG_CONFIG_HOME/waybar/style.css"

# vscode
mkdir -p "$XDG_CONFIG_HOME/Code/User"
ln -sf "$DOTFILES_DIR/vscode/settings.json" "$XDG_CONFIG_HOME/Code/User/settings.json"

echo "Dotfiles successfully linked to XDG directories."
