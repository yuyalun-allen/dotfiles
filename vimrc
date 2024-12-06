"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Environment
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
set runtimepath^=$XDG_CONFIG_HOME/vim
set runtimepath+=$XDG_DATA_HOME/vim
set packpath^=$XDG_DATA_HOME/vim


let g:netrw_home = $XDG_DATA_HOME."/vim"
call mkdir($XDG_DATA_HOME."/vim/spell", 'p')

if !has('nvim') | set viminfofile=$XDG_STATE_HOME/vim/viminfo | endif
set backupdir=$XDG_STATE_HOME/vim/backup | call mkdir(&backupdir, 'p')
set directory=$XDG_STATE_HOME/vim/swap   | call mkdir(&directory, 'p')
set undodir=$XDG_STATE_HOME/vim/undo     | call mkdir(&undodir,   'p')
set viewdir=$XDG_STATE_HOME/vim/view     | call mkdir(&viewdir,   'p')


"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => General
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Sets how many lines of history VIM has to remember
set history=500
set updatetime=100
set termguicolors

" Enable filetype plugins
filetype plugin on
filetype indent on

" Set to auto read when a file is changed from the outside
set autoread

" Disable modeline as a security precaution
set modelines=0
set nomodeline

" With a map leader it's possible to do extra key combinations
" like <leader>w saves the current file
let g:mapleader = ","

" Fast saving
nmap <leader>w :w!<cr>

" Fast command
nmap ! :!

" :W sudo saves the file 
" (useful for handling the permission-denied error)
command W w !sudo tee % > /dev/null

" Use system clipboard
set clipboard+=unnamedplus

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => VIM user interface
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Set 7 lines to the cursor - when moving vertically using j/k
set so=7

" Decrease delay of <esc>
set ttimeoutlen=5

" Avoid garbled characters in Chinese language windows OS
let $LANG='en'
set langmenu=en
source $VIMRUNTIME/delmenu.vim
source $VIMRUNTIME/menu.vim

" Show line number
set number
set relativenumber
set laststatus=2
" Turn on the WiLd menu
set wildmenu

" Ignore compiled files
set wildignore=*.o,*~,*.pyc
if has("win16") || has("win32")
    set wildignore+=.git\*,.hg\*,.svn\*
else
    set wildignore+=*/.git/*,*/.hg/*,*/.svn/*,*/.DS_Store
endif

"Always show current position
set ruler

" Height of the command bar
set cmdheight=1

" A buffer becomes hidden when it is abandoned
set hid

" Configure backspace so it acts as it should act
set backspace=eol,start,indent
set whichwrap+=<,>,h,l

" Ignore case when searching
set ignorecase

" When searching try to be smart about cases
set smartcase

" Highlight search results
set hlsearch

" Makes search act like search in modern browsers
set incsearch

" Don't redraw while executing macros (good performance config)
set lazyredraw

" For regular expressions turn magic on
set magic

" Show matching brackets when text indicator is over them
set showmatch

" How many tenths of a second to blink when matching brackets
set mat=1

" No annoying sound on errors
set noerrorbells visualbell t_vb=

" Add a bit extra margin to the left
set foldcolumn=1

" 跳转到下一个空行
function! JumpToNextBlankLine()
    let save_pos = getpos(".")
    if search('^\s*$', 'W')
    else
        call setpos('.', save_pos)
        echo "No more blank lines"
    endif
endfunction

" 跳转到上一个空行
function! JumpToPrevBlankLine()
    let save_pos = getpos(".")
    if search('^\s*$', 'bW')
    else
        call setpos('.', save_pos)
        echo "No more blank lines"
    endif
endfunction

" quick jump to next/prev blank line
nnoremap ]<Space> :call JumpToNextBlankLine()<CR>
nnoremap [<Space> :call JumpToPrevBlankLine()<CR>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Colors and Fonts
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Enable syntax highlighting
syntax enable

set t_Co=256
set background=light
colorscheme PaperColor

" Set extra options when running in GUI mode
if has("gui_running")
    set guioptions-=T
    set guioptions-=e
    set guitablabel=%M\ %t
endif

" Set utf8 as standard encoding and en_US as the standard language
set encoding=utf8

" Use Unix as the standard file type
set ffs=unix,dos,mac


"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Files, backups and undo
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Turn backup off, since most stuff is in SVN, git et.c anyway...
set nobackup
set nowb
set noswapfile


"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Text, tab and indent related
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Use spaces instead of tabs
set expandtab

" Be smart when using tabs ;)
set smarttab

" 1 tab == 2 spaces
set shiftwidth=2
set tabstop=2

" Linebreak on 500 characters
set lbr
set tw=500

set ai "Auto indent
set si "Smart indent
set wrap "Wrap lines

""""""""""""""""""""""""""""""
" => Visual mode related
""""""""""""""""""""""""""""""
" Visual mode pressing * or # searches for the current selection
" Super useful! From an idea by Michael Naumann
" In visual mode when you press * or # to search for the current selection
vnoremap <silent> * :call VisualSearch('f')<CR>
vnoremap <silent> # :call VisualSearch('b')<CR>

function! VisualSearch(direction) range
    let l:saved_reg = @"
    execute "normal! vgvy"

    let l:pattern = escape(@", "\/.*'$^~[]")
    let l:pattern = substitute(l:pattern, "\n$", "", "")

    if a:direction == 'b'
        execute "normal ?" . l:pattern . "\<CR>"
    else
        execute "normal /" . l:pattern . "\<CR>"
    endif

    let @/ = l:pattern
    let @" = l:saved_reg
endfunction
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Moving around, tabs, windows and buffers
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" Map <Space> to / (search) and Ctrl-<Space> to ? (backwards search)
map <space> ?

" Disable highlight when <leader><cr> is pressed
map <silent> <leader><cr> :noh<cr>

" Smart way to move between windows
map <C-j> <C-W>j
map <C-k> <C-W>k
map <C-h> <C-W>h
map <C-l> <C-W>l

map <leader>b :ls<cr>

" Close the current buffer
map <leader>bd :bclose<cr>:tabclose<cr>gT

" Close all the buffers
map <leader>ba :bufdo bd<cr>

map <leader>l :bnext<cr>
map <leader>h :bprevious<cr>

" Useful mappings for managing tabs
map <leader>tn :tabnew<cr>
map <leader>to :tabonly<cr>
map <leader>tc :tabclose<cr>

" Move a line of text using ALT+[jk] or Command+[jk] on mac
execute "set <M-j>=\ej"
execute "set <M-k>=\ek"
nmap <M-j> mz:m+<cr>`z
nmap <M-k> mz:m-2<cr>`z
vmap <M-k> :m'<-2<cr>`>my`<mzgv`yo`z
vmap <M-j> :m'>+<cr>`<my`>mzgv`yo`z
nnoremap <C-w>x <C-w>c

" Customizing
set pastetoggle=<F10>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => ALE settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

nmap <leader>d :ALEDetail<CR>

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Clap settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

hi ClapCurrentSelection gui=bold guibg=#7a804d guifg=black

nmap <C-p> :Clap<CR> 
" Specify this variable to enable the plugin feature.
 let g:clap_plugin_experimental = v:true
 augroup TreeSitterHighlight
     autocmd!
     autocmd FileType python,go ClapAction syntax.treeSitterHighlight
 augroup END

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => Copilot settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

augroup DisableCopilot
    autocmd!
    autocmd FileType markdown execute 'Copilot disable'
augroup END


"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => LSP settings
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" Fold action
" set foldmethod=expr
"   \ foldexpr=lsp#ui#vim#folding#foldexpr()
"   \ foldtext=lsp#ui#vim#folding#foldtext()

" For asyncomplete
inoremap <expr> <Tab>   pumvisible() ? "\<C-n>" : "\<Tab>"
inoremap <expr> <S-Tab> pumvisible() ? "\<C-p>" : "\<S-Tab>"
inoremap <expr> <cr>    pumvisible() ? asyncomplete#close_popup() : "\<cr>"

let g:lsp_semantic_enabled = 1
nnoremap gd :LspDefinition<cr>
nnoremap gD :LspDeclaration<cr>
nnoremap gi :LspImplementation<cr>
nnoremap gr :LspReferences<cr>

let g:lsp_log_verbose = 1
let g:lsp_log_file = expand('/tmp/vim-lsp.log')
nnoremap <leader>sl :split /tmp/vim-lsp.log<CR>


" Semantic highlight

let python_highlight_all = 1
let g:lsp_settings = {
  \ 'clangd': {
  \   'semantic_highlighting': {
  \     'Function': 'Function',
  \     'Variable': 'Variable'
  \ }}}

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => For nvim
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" lua << EOF
" require'nvim-treesitter.configs'.setup {
"   ensure_installed = "python",  -- Add any other languages you want here
"   highlight = {
"     enable = true,              -- Enable Tree-sitter syntax highlighting
"     additional_vim_regex_highlighting = false,  -- Disable default Vim regex highlighting
"   },
" }
" EOF
"

"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
" => For image pasting
"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

autocmd FileType markdown,tex nmap <buffer><silent> <leader>p :call mdip#MarkdownClipboardImage()<CR>

