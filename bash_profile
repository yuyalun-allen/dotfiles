#
# ~/.bash_profile
#

export $(/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator | sed '/:$/d; /^$/d' | xargs)
[[ -f ~/.bashrc ]] && . ~/.bashrc

neofetch

