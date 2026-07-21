# ccmm — Claude Code 模型方案管理器

> **切换 Claude Code 模型的最快方式。** 自定义你的模型方案 — 把每个思维深度（自动 / 高 / 中 / 低 / 子代理）映射到任意模型的任意供应商。然后 `!ccmm use deepseek` 一键切换全部 5 个槽位。会话中实时生效，无需重启。
>
> 附赠：实时费用计量、缓存命中追踪、预算告警 — 全在状态栏。

< [English](./README.md) | 简体中文 >

<p align="center">
  <a href="https://www.npmjs.com/package/@pgwtf/ccmm"><img src="https://img.shields.io/npm/v/@pgwtf/ccmm?color=blue" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@pgwtf/ccmm" alt="license" /></a>
  <img src="https://img.shields.io/node/v/@pgwtf/ccmm" alt="node version" />
</p>

```
┌──────────────┐   ANTHROPIC_BASE_URL    ┌──────────────┐        ┌─────────────────────┐
│  Claude Code │ ───────────────────────▶│  ccmm 代理    │───────▶│ Anthropic / 中继 /  │
│    (CLI)     │◀─────────────────────── │  (本地)       │◀───────│ API 兼容 / 本地     │
└──────────────┘                         └──────┬───────┘        └─────────────────────┘
        ▲  状态栏                               │ 重写 model、计量用量、计算费用
        └──────────── 读取实时指标 ─────────────┘  ~/.ccmm/ (config · route · metrics)
```

---

## ❓ 为什么需要 ccmm？

Claude Code 会自动根据思维深度选择模型，但它不会让你**自己决定用哪个模型**——更不会让你**一键切换全部五个**。

ccmm 把这个权力还给你：你定义一个**方案** — 一组命名的五槽模型映射，把每个思维深度（自动 / 高 / 中 / 低 / 子代理）指向你选择的任意模型、任意供应商。然后一条命令切换整套方案。会话中实时生效，无需重启。

> **v1 仅支持 Anthropic Messages API 格式。** 你的供应商必须兼容 Anthropic 协议。OpenAI 格式翻译在路线图中。

除此之外：

- **你的价格，不是 Anthropic 的** — 如果你走中继或第三方供应商，Claude Code 内置的费用数字是错的。ccmm 在代理层按**实际转发**的模型和你的自定义价格表计量。
- **缓存命中率可见** — ccmm 从 SSE 事件中捕获缓存读取和写入 token，在状态栏显示真实的缓存命中率。你能看到你的供应商是否给了你应得的缓存。
- **不打断工作流** — 在 Claude Code 输入框里敲 `!ccmm use 我的模型`。热重载，即时生效。

## ✨ 功能

| | |
|---|---|
| 🔀 **实时切换** | `!ccmm use deepseek` → 下一条消息立即生效，无需重启。 |
| 📊 **实时状态栏** | 当前模型 · token 进出 · 缓存命中率 · 今日费用 · 剩余预算。 |
| 🌐 **任意供应商** | Anthropic、DeepSeek、OpenRouter、Vercel AI、Moonshot 或任意兼容端点。 |
| 🗂 **命名方案** | 一个 `ccmm use <名称>` 切换整套 5 槽模型映射。 |
| 💵 **自定义定价** | 按模型设置价格表，中继背后费用也准确。 |
| 🚦 **预算告警** | 每日消费上限，状态栏实时可见。 |
| 🎛 **交互式配置** | `ccmm config` — 菜单式编辑器，浏览修改所有设置。 |
| 🌍 **中英双语** | 在 `ccmm setup` 时选择语言，`ccmm config` 中随时切换。 |
| 🚀 **开机自启** | 可选：系统登录时自动启动代理守护进程。 |
| 🔄 **自动更新** | `ccmm update` 检查新版本；运行 `start`/`config`/`setup` 时自动提示。 |
| 🧩 **插件集成** | 安装时自动注册状态栏和 MCP 工具。 |

## 📋 环境要求

- Node.js >= 18.0.0
- 已安装 Claude Code（`@anthropic-ai/claude-code`）

## 📦 安装

```bash
npm install -g @pgwtf/ccmm
ccmm setup         # 交互式向导：选语言 → 添加方案 → 配置 5 槽模型映射 → 完成
```

`ccmm setup` 一站式完成所有初始化（包括 init、方案配置、设置同步）。可重复执行，每次都会备份被修改的文件。

## 🚀 快速上手

```bash
ccmm setup                # 首次配置向导（已配置过可跳过）
ccmm config               # 交互式编辑器 — 随时调整方案、定价、预算
ccmm start                # 启动代理守护进程
ccmm use deepseek         # 切换到 DeepSeek（Claude 内 `!ccmm use deepseek`）
ccmm stats today          # 看看今天花了多少？
ccmm update               # 检查并安装更新
```

## 📟 命令

| 命令 | 说明 |
|---|---|
| `ccmm setup` | 交互式配置向导 — 添加方案、5 槽映射、预算、自启 |
| `ccmm config` | 交互式配置编辑器 — 浏览修改所有设置 |
| `ccmm start` / `stop` / `logs` | 管理代理守护进程 |
| `ccmm use <名称>` | 切换活跃方案（热重载，即时生效） |
| `ccmm current` | 显示当前活跃方案和模型 |
| `ccmm models` | 列出所有方案和已定价模型 |
| `ccmm provider add\|rm\|list` | 命令行管理方案 |
| `ccmm price set\|rm\|list` | 管理模型定价 |
| `ccmm stats [today\|session\|week\|all]` | 用量和费用报告 |
| `ccmm statusline` | （内部）渲染状态栏 |
| `ccmm doctor` | 诊断配置 |
| `ccmm update` | 检查更新并安装最新版本 |
| `ccmm init` | 快速非交互式初始化（推荐用 `ccmm setup`） |

## ⚙️ 配置

所有配置存储在 `~/.ccmm/config.json`：

```jsonc
{
  "proxy":   { "host": "127.0.0.1", "port": 8787 },
  "defaultProvider": "deepseek",
  "language": "zh-CN",
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/anthropic",
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "wire": "anthropic",
      "modelMap": {
        "ANTHROPIC_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-flash",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
        "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-v4-flash"
      }
    }
  },
  "prices": {
    "deepseek-v4-pro": { "input": 2.0, "output": 8.0, "cacheRead": 0.2, "cacheWrite": 3.0 }
  },
  "budget": { "dailyUsd": 20, "alert": true }
}
```

- **方案 (Provider)** — 一个命名配置（端点 + API Key + 5 槽 `modelMap`）。`ccmm use <名称>` 一键切换整套方案。
- **`modelMap`** — 将 Claude Code 的 5 个思维深度占位符映射到实际上游模型 ID。
- **定价** — 美元 / 100万 tokens。费用按**实际转发**的模型计算，不受中继重映射影响。
- **`language`** — 界面语言，`"zh-CN"` 或 `"en"`。

## 🔧 工作原理

1. `ccmm setup` 在 Claude Code 设置中写入 `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`。
2. Claude Code 所有 API 请求流经 ccmm 代理。
3. 代理检查活跃方案的 `modelMap` → 重写 `body.model` → 转发到供应商。
4. 响应流透明回传；从 SSE 事件中捕获 `usage` 用于计量。
5. **Prompt 缓存完全保留** — 代理只改 `body.model` 和认证头，`cache_control` 原封不动。

## 📊 状态栏

```
🧠 deepseek-v4-pro · ▲12.4k ▼3.1k · cache 87% · $0.42 today · $19.58 left
```

代理未运行时自动降级为解析 Claude Code 的 transcript JSONL。

## 🗺️ 路线图

交互式 TUI 面板、模型推荐、Bedrock/Vertex 供应商、OpenAI 协议翻译。

## 🙏 致谢

- [tweakcc](https://github.com/Piebald-AI/tweakcc) · [claude-code-router](https://github.com/musistudio/claude-code-router) · [LiteLLM](https://github.com/BerriAI/litellm)
- [How I built a hot-swappable backend proxy for Claude Code](https://hackernoon.com/how-i-built-a-hot-swappable-backend-proxy-for-claude-code)
- Anthropic [LLM gateway 文档](https://code.claude.com/docs/en/llm-gateway-connect)

## ⚖️ 免责声明

ccmm 是独立开源项目 — **与 Anthropic 无关亦未经其背书**。API Key 存储在本地 `~/.ccmm/`，仅发送到你指定的供应商。

## 📄 许可证

MIT ([LICENSE](./LICENSE))。
