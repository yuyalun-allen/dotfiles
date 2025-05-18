#
# ~/.bash_profile
#

export $(/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator | sed '/:$/d; /^$/d' | xargs)

# Add path for user defined applications
export PATH="~/Applications/bin:$PATH"
# Add path for go
export PATH="$GOPATH/bin:$PATH"
# Add path for rust
export PATH="$CARGO_HOME/bin:$PATH"
# Add path for ruby
export GEM_HOME="$(gem env user_gemhome)"
export PATH="$GEM_HOME/bin:$PATH"
# Created by `pipx` on 2024-10-28 03:28:41
export PATH="/home/allen/.local/bin:$PATH"

[[ -f ~/.bashrc ]] && . ~/.bashrc
