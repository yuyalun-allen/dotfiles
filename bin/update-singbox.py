#!/usr/bin/env python3
import json
import urllib.request
import subprocess
import shutil
import sys
import os
import argparse

TARGET_CONFIG = "/etc/sing-box/default.json"
BACKUP_DIR = os.path.expanduser("~/.local/state/sing-box")
BACKUP_CONFIG = os.path.join(BACKUP_DIR, "default.json.bak")
TEMP_CONFIG = "/tmp/singbox_new.json"
DEFAULT_URL_FILE = os.path.expanduser("~/.config/sing-box/subscription.url")
SERVICE_NAME = "sing-box@default"

def get_subscription_url(cli_url=None):
    if cli_url:
        return cli_url.strip()
    env_url = os.environ.get("SINGBOX_SUB_URL")
    if env_url:
        return env_url.strip()
    if os.path.exists(DEFAULT_URL_FILE):
        try:
            with open(DEFAULT_URL_FILE, "r", encoding="utf-8") as f:
                url = f.read().strip()
                if url:
                    return url
        except Exception as e:
            print(f"[-] 读取凭据文件 {DEFAULT_URL_FILE} 失败: {e}", file=sys.stderr)
    
    print("[-] 错误: 未检测到 sing-box 订阅 URL！", file=sys.stderr)
    print("    请通过以下任一方式配置订阅链接:\n"
          f"    1. 写入配置文件: echo 'YOUR_URL' > {DEFAULT_URL_FILE} && chmod 600 {DEFAULT_URL_FILE}\n"
          "    2. 设置环境变量: export SINGBOX_SUB_URL='YOUR_URL'\n"
          "    3. 命令行参数指定: update-singbox.py --url 'YOUR_URL'", file=sys.stderr)
    sys.exit(1)

def trigger_reload():
    print(f"[*] 正在尝试平滑重载 {SERVICE_NAME} ...")
    try:
        res = subprocess.run(["systemctl", "reload", SERVICE_NAME], capture_output=True, text=True)
        if res.returncode == 0:
            print("[+] sing-box 已平滑重载新配置！")
            return True
        else:
            print(f"[-] 自动重载未成功 ({res.stderr.strip()})")
            print(f"[*] 请在你的终端执行: systemctl reload {SERVICE_NAME} (或 restart)")
            return False
    except Exception as e:
        print(f"[-] 执行重载异常: {e}", file=sys.stderr)
        return False

def build_optimized_config(remote_cfg, local_cfg):
    # 1. 动态提取自定义节点（排除订阅原有节点及脚本管理的分组）
    remote_outbounds = remote_cfg.get("outbounds", [])
    remote_tags = {o["tag"] for o in remote_outbounds if "tag" in o}
    managed_groups = {"AI", "YouTube", "Proxy", "Media", "gpt", "Express", "Download", "Netflix"}

    custom_nodes = [
        o for o in local_cfg.get("outbounds", [])
        if o.get("tag") not in remote_tags and o.get("tag") not in managed_groups
    ]
    custom_node_tags = [o["tag"] for o in custom_nodes]

    # 2. 提取订阅中的基础代理节点
    base_node_tags = [
        o["tag"] for o in remote_outbounds
        if o.get("type") not in ("selector", "urltest", "direct")
    ]

    # 筛选亚太低延迟节点（用于 YouTube / YTM / 常用流媒体）
    asia_nodes = [t for t in base_node_tags if t.startswith(("TW-", "JP-", "SG-", "HK-"))]

    # 筛选全部大容量/负载均衡节点（Balancer 系列，专用于大文件下载）
    balancer_nodes = [t for t in base_node_tags if "Balancer" in t]

    # 筛选美区专线独立 IP 节点（Dedicated 系列，保证 Scholar/AI 的 IP 纯净度）
    us_dedicated_nodes = [t for t in base_node_tags if "US-Dedicated" in t]

    # 筛选 Netflix / 美区流媒体专用节点（直接归入 YouTube，不再保留独立的 Netflix 策略组）
    netflix_nodes = [t for t in base_node_tags if "Netflix" in t]

    # (0) 强化 Scholar 学术组：确保包含 US-Dedicated 独享节点
    scholar_group = next((o for o in remote_outbounds if o.get("tag") == "Scholar"), None)
    if scholar_group:
        s_outbounds = scholar_group.get("outbounds", [])
        for ud in reversed(us_dedicated_nodes):
            if ud not in s_outbounds:
                insert_idx = 4 if len(s_outbounds) >= 4 else 0
                s_outbounds.insert(insert_idx, ud)

    # 3. 构造专职策略组（严格单向依赖，禁止回路）
    # (a) AI 组：聚合自建优化节点、美区学术专线及自动优选
    ai_group = {
        "type": "selector",
        "tag": "AI",
        "outbounds": custom_node_tags + ["Scholar", "auto", "direct"],
        "default": custom_node_tags[0] if custom_node_tags else "Scholar"
    }

    # (b) YouTube 组：合并 YouTube、YTM 及 Netflix、Spotify 等全部流媒体
    youtube_group = {
        "type": "selector",
        "tag": "YouTube",
        "outbounds": ["auto", "auto-anytls"] + asia_nodes + netflix_nodes + ["direct"],
        "default": "auto"
    }

    # (c) Download 大容量下载组：聚合所有 Balancer 节点，专门备用于境外大文件下载
    download_group = {
        "type": "selector",
        "tag": "Download",
        "outbounds": balancer_nodes + ["auto", "direct"],
        "default": balancer_nodes[0] if balancer_nodes else "auto"
    }

    # (d) Manually 手工选点组：挂接全部节点供备用选点
    manually_group = next((o for o in remote_outbounds if o.get("tag") == "Manually"), None)
    if manually_group:
        manually_group["outbounds"] = [
            t for t in manually_group.get("outbounds", []) if t != "direct"
        ] + custom_node_tags + ["direct"]

    # (e) Proxy 主组：精简业务策略，挂载 Download 大容量组
    proxy_group = {
        "type": "selector",
        "tag": "Proxy",
        "outbounds": ["auto", "AI", "YouTube", "Scholar", "Download", "auto-anytls", "Manually", "direct"],
        "default": "auto"
    }

    # 4. 组装完整 outbounds 列表
    final_outbounds = []
    for ob in remote_outbounds:
        tag = ob.get("tag")
        if tag == "Proxy":
            final_outbounds.append(proxy_group)
            final_outbounds.append(ai_group)
            final_outbounds.append(youtube_group)
            final_outbounds.append(download_group)
        elif tag in ("gpt", "Media", "Express", "Netflix"):
            continue
        else:
            final_outbounds.append(ob)

    final_outbounds.extend(custom_nodes)

    # 5. TUN Inbound（纯 IPv4，避免系统禁用 IPv6 下内核拒绝绑定导致崩溃）
    tun_inbound = {
        "type": "tun",
        "address": [
            "172.18.0.1/30"
        ],
        "auto_route": True,
        "auto_redirect": False,
        "strict_route": False,
        "route_address": [
            "0.0.0.0/1",
            "128.0.0.0/1"
        ],
        "route_exclude_address_set": [
            "geoip-cn"
        ],
        "route_exclude_address": [
            "10.0.0.0/8",
            "172.16.0.0/12",
            "192.168.0.0/16"
        ]
    }

    # 6. 成熟远程规则集定义
    rule_sets = [
        {
            "tag": "geoip-cn",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-geolocation-cn",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-geolocation-cn.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "category-ai-chat-!cn",
            "type": "remote",
            "format": "source",
            "url": "https://raw.githubusercontent.com/KaringX/karing-ruleset/sing/geo/geosite/category-ai-chat-!cn.json",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-youtube",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-youtube.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-netflix",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-netflix.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-spotify",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-spotify.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-disney",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-disney.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-category-scholar-!cn",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-scholar-!cn.srs",
            "http_client": "rule-fetch"
        },
        {
            "tag": "geosite-steam@cn",
            "type": "remote",
            "format": "binary",
            "url": "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-steam@cn.srs",
            "http_client": "rule-fetch"
        }
    ]

    # 7. 路由规则分流
    route_rules = [
        {"action": "sniff"},
        {"protocol": "dns", "action": "hijack-dns"},
        {"ip_is_private": True, "outbound": "direct"},
        {"port": [25, 26], "outbound": "direct"},
        {"rule_set": ["geosite-steam@cn"], "outbound": "direct"},
        {"domain_suffix": ["steamcontent.com", "steamserver.net"], "outbound": "direct"},
        {"rule_set": ["geosite-geolocation-cn", "geoip-cn"], "outbound": "direct"},
        {"rule_set": ["category-ai-chat-!cn"], "outbound": "AI"},
        {"rule_set": ["geosite-youtube", "geosite-netflix", "geosite-spotify", "geosite-disney"], "outbound": "YouTube"},
        {"rule_set": ["geosite-category-scholar-!cn"], "outbound": "Scholar"}
    ]

    # 8. 优化的 DNS 结构（Steam 与国内直通阿里 DNS，ipv4_only 杜绝泄漏）
    dns_config = {
        "servers": [
            {
                "tag": "local",
                "type": "https",
                "server": "223.5.5.5"
            },
            {
                "tag": "remote",
                "type": "https",
                "server": "1.1.1.1",
                "detour": "auto"
            }
        ],
        "rules": [
            {
                "domain_suffix": [
                    ".gladns.net",
                    ".gladns.com",
                    ".glados-config.com",
                    ".glados-config.net"
                ],
                "server": "local"
            },
            {
                "rule_set": ["geosite-geolocation-cn", "geosite-steam@cn"],
                "server": "local"
            },
            {
                "domain_suffix": ["steamcontent.com", "steamserver.net"],
                "server": "local"
            },
            {
                "rule_set": [
                    "category-ai-chat-!cn",
                    "geosite-youtube",
                    "geosite-netflix",
                    "geosite-spotify",
                    "geosite-disney",
                    "geosite-category-scholar-!cn"
                ],
                "server": "remote"
            },
            {
                "action": "evaluate",
                "server": "remote"
            },
            {
                "match_response": True,
                "rule_set": "geoip-cn",
                "server": "local"
            }
        ],
        "final": "remote",
        "strategy": "ipv4_only"
    }

    final_cfg = {
        "log": local_cfg.get("log", {"level": "info", "timestamp": True}),
        "experimental": local_cfg.get("experimental", {
            "cache_file": {"enabled": True, "cache_id": "glados"},
            "clash_api": {"external_controller": "127.0.0.1:9990"}
        }),
        "dns": dns_config,
        "http_clients": [{"tag": "rule-fetch", "detour": "auto"}],
        "inbounds": [tun_inbound],
        "outbounds": final_outbounds,
        "route": {
            "rules": route_rules,
            "rule_set": rule_sets,
            "final": "Proxy",
            "auto_detect_interface": True,
            "default_domain_resolver": "local",
            "default_http_client": "rule-fetch"
        }
    }
    return final_cfg, custom_node_tags, balancer_nodes

def main():
    parser = argparse.ArgumentParser(description="自动更新与优化 sing-box 订阅配置 (dotfiles 版本)")
    parser.add_argument("--url", help="临时指定订阅 URL (覆盖配置文件与环境变量)")
    parser.add_argument("--reload-only", action="store_true", help="仅触发服务热重载，不更新配置")
    parser.add_argument("--no-reload", action="store_true", help="写入新配置后不重载服务")
    args = parser.parse_args()

    if args.reload_only:
        trigger_reload()
        return

    sub_url = get_subscription_url(args.url)
    print(f"[1/4] 从订阅拉取最新配置: {sub_url[:35]}... (URL已隐藏脱敏)")
    try:
        req = urllib.request.Request(sub_url, headers={"User-Agent": "sing-box"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            remote_cfg = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"[-] 拉取订阅失败: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"[2/4] 读取现有配置并重构业务分流架构...")
    if not os.path.exists(TARGET_CONFIG):
        print(f"[-] 本地配置文件不存在: {TARGET_CONFIG}", file=sys.stderr)
        sys.exit(1)

    with open(TARGET_CONFIG, "r", encoding="utf-8") as f:
        local_cfg = json.load(f)

    final_cfg, custom_nodes, balancer_nodes = build_optimized_config(remote_cfg, local_cfg)
    if custom_nodes:
        print(f"      继承自定义节点: {', '.join(custom_nodes)}")
    if balancer_nodes:
        print(f"      归纳大容量下载节点 ({len(balancer_nodes)} 个): {', '.join(balancer_nodes[:4])} ...")

    # 校验
    print("[3/4] 验证新配置语法与节点引用有效性...")

    # (a) 出站依赖有向无环图（DAG）校验
    outbound_map = {o["tag"]: o.get("outbounds", []) for o in final_cfg.get("outbounds", []) if "outbounds" in o}
    def find_cycle(start, visited, stack):
        visited.add(start)
        stack.append(start)
        for nxt in outbound_map.get(start, []):
            if nxt in stack:
                return stack + [nxt]
            if nxt in outbound_map and nxt not in visited:
                cycle = find_cycle(nxt, visited, stack)
                if cycle:
                    return cycle
        stack.pop()
        return None

    visited = set()
    for node in outbound_map:
        if node not in visited:
            cycle = find_cycle(node, visited, [])
            if cycle:
                print(f"[-] 检测到出站组循环依赖: {' -> '.join(cycle)}，已中止更新！", file=sys.stderr)
                sys.exit(1)

    # (b) sing-box check 语法校验
    with open(TEMP_CONFIG, "w", encoding="utf-8") as f:
        json.dump(final_cfg, f, indent=2, ensure_ascii=False)

    check_res = subprocess.run(["sing-box", "check", "-c", TEMP_CONFIG], capture_output=True, text=True)
    if check_res.returncode != 0:
        print(f"[-] 配置语法校验未通过，已放弃写入:\n{check_res.stderr}", file=sys.stderr)
        if os.path.exists(TEMP_CONFIG):
            os.remove(TEMP_CONFIG)
        sys.exit(1)
    print("      sing-box 语法与出站依赖校验全部通过！")

    # 备份与写入
    print(f"[4/4] 备份旧配置到 {BACKUP_CONFIG} 并更新: {TARGET_CONFIG} ...")
    try:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        shutil.copyfile(TARGET_CONFIG, BACKUP_CONFIG)
        shutil.copyfile(TEMP_CONFIG, TARGET_CONFIG)
        os.remove(TEMP_CONFIG)
    except Exception as e:
        print(f"[-] 写入目标配置失败: {e}", file=sys.stderr)
        if os.path.exists(TEMP_CONFIG):
            os.remove(TEMP_CONFIG)
        sys.exit(1)

    print("[+] 配置更新完成。")

    if args.no_reload:
        print("[i] 参数已指定 --no-reload，跳过热重载。后台连接未受任何影响。")
    else:
        trigger_reload()

if __name__ == "__main__":
    main()
