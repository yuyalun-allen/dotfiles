#
# ~/.bash_profile
#

export $(/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator | sed '/:$/d; /^$/d' | xargs)

[[ -f ~/.bashrc ]] && . ~/.bashrc


if command -v tmux &> /dev/null && [ -n "$PS1" ] && [[ ! "$TERM" =~ screen ]] && [[ ! "$TERM" =~ tmux ]] && [ -z "$TMUX" ] && [[ "$TERM_PROGRAM" != "vscode" ]] ;then
  exec tmux
fi

neofetch
