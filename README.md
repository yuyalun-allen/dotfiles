# 日常使用的 Linux 配置指南

个人认为今日的 Linux 环境已经是非常可用的状态，如果你和我一样以软件开发为职业或爱好，那么你更应该使用 Linux 而不是 Windows。（*即使 Windows 上的 WSL 提供了方便的 POSIX 兼容开发环境，完全切换到 Linux 也是更加舒适的选择*）

如果你认同这个观点，下面的说明以及仓库中的配置文件应该有助于你更好地拥抱 Linux 操作系统。

## 发行版

首先选择 Linux 发行版，我的看法是既然已经抛弃了冗杂臃肿的 Windows 系统，那你应该和我一样是喜欢 KISS 哲学的人吧，此时 Arch Linux 不失为一种理想的选择。

如果你第一次安装，我强烈建议按照 Arch Linux 官方的 [Installation Guide](https://wiki.archlinux.org/title/Installation_guide) 操作一遍，这会让你对操作系统中的一些概念有更深刻的理解；如果你不想理解操作系统中的概念，或者曾经手动安装过 Linux 系统，只是想跳过冗长且易错的配置过程的话，可以使用 arch installation iso 中提供的 `archinstall` 工具，只需要傻瓜式地逐条配置想要的选项即可。

> 为什么我心血来潮来写这个文档呢，就是不动脑子地使用 `archinstall` 导致必须重装系统了，**傻瓜式地逐条配置**也需要理解每个配置项的具体作用，否则，你有一天也会像我一样需要重装系统。

> 举几个典型的例子：Gnome 或 KDE 下的网络配置要选择 NetworkManager，顺便一提蓝牙需要手动 enable systemd 服务；对于日用的系统来说**“最好的磁盘划分”**如果选择了单独的 /home 分区很可能会导致 / 根分区爆满（*想起被 C 盘爆满支配的恐惧了吗？所以我讨厌分盘，这也是这次重装的原因💦*）；

## 日常使用的配置

假设你已经使用 `archinstall` 得到了以 Gnome 为桌面环境的 Arch Linux 系统，此时的系统环境已经基本可用，但距离**舒适的日常使用**还有差距。

> 一切都是开箱即用的，除非你像我一样使用了 IPU6 摄像头，我的 Matebook X Pro 2024 上华为没有提供开源的摄像头传感器固件支持，所以摄像头基本上废了。

### 基本软件

`sudo pacman -S firefox kitty git tmux vim less wl-clipboard`

这一条命令可以安装平时 50 % 以上时间在打交道的软件，然后使用本仓库中提供的配置文件就可以正常使用（如果你想直接使用，注意修改 git 的一些配置）

下一步当然是安装 `aur helper` 啦，这里推荐 [paru](https://github.com/Morganamilo/paru)，按照README中的步骤逐步安装即可。

有了 `paru` 之后就可以方便地安装非常丰富的软件资源了，比如首先安装 gnome 的插件管理器（extension-manager），

### 省电环境

如果使用笔记本，默认调度下的功耗是很高的，此时续航对比 Windows 都是要更差劲的，然而只要做一些配置就可以免费获得比 Windows 长 1-2 小时的日常使用时间，使用 paru 安装 `auto-cpufreq` 然后启动 auto-cpufreq 的 systemd 服务，就可以在离电情况下自动降低 CPU 频率。

如果你是 intel 的大小核架构 cpu 还可以使用 `intel-lpmd` 优化大小核调度（注意同样需要启动 systemd 服务）。

### 中文环境

系统 Locale 中设置英文是完全没有问题的，而且这种环境下 `gcc` 等工具的报错信息搜索解决方案还更加方便，不过这并不意味着 Linux 环境下就无法使用中文。

主要是两方面，一方面安装中文字体，`noto-fonts-cjk` 和 `wqy-microhei` 两款应该足够（甚至只需要前者你就可以正常浏览 www.baidu.com，~~这应该是我唯一一次需要访问它~~）；另一方面安装中文输入法，`sudo pacman -S fcitx5-im fcitx5-chinese-addons` 安装输入法（Input Method）和对应的中文组件，然后安装 Gnome 的 Input Method Panel 即可愉快地输入中文啦。

> 注意：配置 fcitx5 的语言时应该选择 `pinyin` 而不是 `Chinese` 之类的。

### 个性化配置

`sudo pacman -S dconf-editor` 

安装 dconf-editor 之后就可以像使用 Windows 注册表一样方便地开启/关闭一些 Gnome 的 DE 特性，例如 fractional scaling

### 常用软件

`paru -S wechat-bin linuxqq dingtalk-bin qqmusic-bin visual-studio-code-bin zotero-bin wps-office wemeet-bin`

多个愿望一条命令满足，这就是使用 Linux 最爽的几个瞬间之一了吧。

Have Fun!
