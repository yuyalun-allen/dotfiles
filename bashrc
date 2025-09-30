# Enable the subsequent settings only in interactive sessions
case $- in
  *i*) ;;
    *) return;;
esac

# Path to your oh-my-bash installation.
export OSH='/home/allen/.config/oh-my-bash'

# Set name of the theme to load. Optionally, if you set this to "random"
# it'll load a random theme each time that oh-my-bash is loaded.
OSH_THEME="font"

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion. Case
# sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment the following line to disable bi-weekly auto-update checks.
DISABLE_AUTO_UPDATE="true"

# Uncomment the following line to change how often to auto-update (in days).
# export UPDATE_OSH_DAYS=13

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.  One of the following values can
# be used to specify the timestamp format.
# * 'mm/dd/yyyy'     # mm/dd/yyyy + time
# * 'dd.mm.yyyy'     # dd.mm.yyyy + time
# * 'yyyy-mm-dd'     # yyyy-mm-dd + time
# * '[mm/dd/yyyy]'   # [mm/dd/yyyy] + [time] with colors
# * '[dd.mm.yyyy]'   # [dd.mm.yyyy] + [time] with colors
# * '[yyyy-mm-dd]'   # [yyyy-mm-dd] + [time] with colors
# If not set, the default value is 'yyyy-mm-dd'.
# HIST_STAMPS='yyyy-mm-dd'

# Uncomment the following line if you do not want OMB to overwrite the existing
# aliases by the default OMB aliases defined in lib/*.sh
# OMB_DEFAULT_ALIASES="check"

# Would you like to use another custom folder than $OSH/custom?
# OSH_CUSTOM=/path/to/new-custom-folder

# To disable the uses of "sudo" by oh-my-bash, please set "false" to
# this variable.  The default behavior for the empty value is "true".
OMB_USE_SUDO=true

# Which completions would you like to load? (completions can be found in ~/.oh-my-bash/completions/*)
# Custom completions may be added to ~/.oh-my-bash/custom/completions/
# Example format: completions=(ssh git bundler gem pip pip3)
# Add wisely, as too many completions slow down shell startup.
completions=(
  git
  composer
  ssh
)

# Which aliases would you like to load? (aliases can be found in ~/.oh-my-bash/aliases/*)
# Custom aliases may be added to ~/.oh-my-bash/custom/aliases/
# Example format: aliases=(vagrant composer git-avh)
# Add wisely, as too many aliases slow down shell startup.
aliases=(
  general
)

# Which plugins would you like to load? (plugins can be found in ~/.oh-my-bash/plugins/*)
# Custom plugins may be added to ~/.oh-my-bash/custom/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(
  git
  bashmarks
)

# Which plugins would you like to conditionally load? (plugins can be found in ~/.oh-my-bash/plugins/*)
# Custom plugins may be added to ~/.oh-my-bash/custom/plugins/
# Example format: 
#  if [ "$DISPLAY" ] || [ "$SSH" ]; then
#      plugins+=(tmux-autoattach)
#  fi

source "$OSH"/oh-my-bash.sh

# User configuration
# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
export LANGUAGE=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='mvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch x86_64"

# ssh
# export SSH_KEY_PATH="~/.ssh/rsa_id"

# Set personal aliases, overriding those provided by oh-my-bash libs,
# plugins, and themes. Aliases can be placed here, though oh-my-bash
# users are encouraged to define aliases within the OSH_CUSTOM folder.
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias bashconfig="mate ~/.bashrc"
# alias ohmybash="mate ~/.oh-my-bash"

# Customized behavior
set -o vi
bind -x '"\C-l": clear'
# NNN Plugin
export NNN_PLUG='c:-!echo $PWD/$nnn|wl-copy*;f:fzcd;j:autojump;d:diffs;t:nmount;v:imgview'
n ()
{
  # Block nesting of nnn in subshells
  if [[ "${NNNLVL:-0}" -ge 1 ]]; then
    echo "nnn is already running"
    return
  fi
  
  # The behaviour is set to cd on quit (nnn checks if NNN_TMPFILE is set)
  # If NNN_TMPFILE is set to a custom path, it must be exported for nnn to
  # see. To cd on quit only on ^G, remove the "export" and make sure not to
  # use a custom path, i.e. set NNN_TMPFILE *exactly* as follows:
  #     NNN_TMPFILE="${XDG_CONFIG_HOME:-$HOME/.config}/nnn/.lastd"
  export NNN_TMPFILE="${XDG_CONFIG_HOME:-$HOME/.config}/nnn/.lastd"
  
  # Unmask ^Q (, ^V etc.) (if required, see `stty -a`) to Quit nnn
  # stty start undef
  # stty stop undef
  # stty lwrap undef
  # stty lnext undef
  
  # The backslash allows one to alias n to nnn if desired without making an
  # infinitely recursive alias
  \nnn "$@"
  
  if [ -f "$NNN_TMPFILE" ]; then
        . "$NNN_TMPFILE"
        rm -f "$NNN_TMPFILE" > /dev/null
  fi
}

# HSTR configuration - add this to ~/.bashrc
alias hh=hstr                    # hh to be alias for hstr
export HSTR_CONFIG=hicolor       # get more colors
shopt -s histappend              # append new history items to .bash_history
export HISTCONTROL=ignorespace   # leading space hides commands from history
export HISTFILESIZE=10000        # increase history file size (default is 500)
export HISTSIZE=${HISTFILESIZE}  # increase history size (default is 500)
# ensure synchronization between bash memory and history file
export PROMPT_COMMAND="history -a; history -n; ${PROMPT_COMMAND}"
function hstrnotiocsti {
    { READLINE_LINE="$( { </dev/tty hstr ${READLINE_LINE}; } 2>&1 1>&3 3>&- )"; } 3>&1;
    READLINE_POINT=${#READLINE_LINE}
}
# if this is interactive shell, then bind hstr to Ctrl-r (for Vi mode check doc)
if [[ $- =~ .*i.* ]]; then bind -x '"\C-h": "hstrnotiocsti"'; fi
export HSTR_TIOCSTI=n

eval "$(rbenv init -)"

[[ -r "/usr/share/z/z.sh" ]] && source /usr/share/z/z.sh

# nvm
if [ -d "/usr/share/nvm" ]; then
  source /usr/share/nvm/nvm.sh
  source /usr/share/nvm/bash_completion
fi

export http_proxy=http://localhost:7890
export https_proxy=http://localhost:7890

# Alias
alias open="xdg-open"
alias activate=". ./.venv/bin/activate"

alias reboot="systemctl reboot"
alias poweroff="systemctl poweroff"

alias todo="pushd $HOME/Documents/private && vim TODO.md"

if command -v tmux &> /dev/null && [ -n "$PS1" ] && [[ ! "$TERM" =~ screen ]] && [[ ! "$TERM" =~ tmux ]] && [ -z "$TMUX" ] && [[ "$TERM_PROGRAM" != "vscode" ]] ;then
  exec tmux
fi

# In bashrc
bind 'set show-all-if-ambiguous on'
# --- 路径定义 ---
# 定义一个文件，用于存储 _WORKING_DIR 的值
# 通常放在用户主目录下比较安全
_WORKING_DIR_FILE="$HOME/.working_dir_path"

# --- 启动时加载 ---
# 检查持久化文件是否存在，如果存在就加载路径
if [ -f "$_WORKING_DIR_FILE" ]; then
  export _WORKING_DIR=$(cat "$_WORKING_DIR_FILE")
fi

# --- 函数定义 ---

# setcwd: 设置当前目录为 _WORKING_DIR 并保存到文件
# 用法: setcwd
function setcwd() {
  if [ -r "$(pwd)" ] && [ -x "$(pwd)" ]; then
    _WORKING_DIR="$(pwd)"
    # 将路径保存到文件中
    echo "$_WORKING_DIR" > "$_WORKING_DIR_FILE"
    echo "工作目录已设置为: $_WORKING_DIR"
  else
    echo "错误: 当前目录不可访问，无法设置为工作目录。"
    return 1
  fi
}

# cdcwd: 切换到之前设置的 _WORKING_DIR
# 用法: cdcwd
function cdcwd() {
  # 检查变量是否已设置
  if [ -z "$_WORKING_DIR" ]; then
    echo "错误: _WORKING_DIR 未设置。请先使用 'setcwd' 命令。"
    return 1
  fi

  # 检查目录是否存在且可进入
  if [ -d "$_WORKING_DIR" ] && [ -x "$_WORKING_DIR" ]; then
    cd "$_WORKING_DIR" || return 1
    echo "已切换到工作目录: $(pwd)"
  else
    echo "错误: 工作目录 '$_WORKING_DIR' 不存在或不可进入，已清除记录。"
    # 如果目录不存在，就清空变量和文件记录
    _WORKING_DIR=""
    rm -f "$_WORKING_DIR_FILE"
    return 1
  fi
}

neofetch
