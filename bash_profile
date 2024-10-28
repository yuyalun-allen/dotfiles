#
# ~/.bash_profile
#

export $(/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator | sed '/:$/d; /^$/d' | xargs)
[[ -f ~/.bashrc ]] && . ~/.bashrc

neofetch


# Created by `pipx` on 2024-10-28 03:28:41
export PATH="$PATH:/home/allen/.local/bin"
