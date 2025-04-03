#
# ~/.bash_profile
#

export $(/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator | sed '/:$/d; /^$/d' | xargs)

# Add path for user defined applications
export PATH="$PATH:~/Applications/bin"
# Add path for go
export PATH="$PATH:$GOPATH/bin"
# Add path for rust
export PATH="$PATH:$CARGO_HOME/bin"
# Add path for ruby
# export GEM_HOME="$(gem env user_gemhome)"
export PATH="$PATH:$GEM_HOME/bin"
# Created by `pipx` on 2024-10-28 03:28:41
export PATH="$PATH:/home/allen/.local/bin"

[[ -f ~/.bashrc ]] && . ~/.bashrc
