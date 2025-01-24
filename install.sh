echo "Installing AUR Helper paru ..."

if [ ! -d "~/Applications" ]; then
    mkdir "~/Applications" && cd "~/Applications"
    git clone https://github.com/Morganamilo/paru.git && cd "paru"
    makepkg -si
fi    
