---
status: implemented
date: 2026-11-02
description: 在通用 godview 看板之上新增原生 Pi coding agent 适配器，复用 store，只提供 TUI 面板。
raised-by: agent
decided-by: human
created: 2026-11-02
paths:
  - package.json
  - packages/pi-godview/package.json
  - packages/pi-godview/extensions/pi-godview.js
  - packages/pi-godview/lib/session.js
  - packages/pi-godview/lib/tools.js
  - packages/pi-godview/lib/guard.js
  - packages/pi-godview/test/pi-godview.test.mjs
  - packages/pi-godview/README.md
  - packages/pi-godview/README.en.md
  - .changeset/config.json
  - AGENTS.md
  - README.md
  - README.en.md
  - docs/protocol.md
---

# ADR: 26 新增原生 Pi coding agent 适配器

## Problem

DSH 适配器是宿主绑定的：它需要 Cordis、一个 DSH profile 和一个浏览器模块加载器。
通用 store 刻意做到宿主中立，而 Pi coding agent 是另一个 TUI 优先的宿主，可以在同
一个仓库里并行运行多个会话。这些会话需要同样的 presence、文件租约和占用/释放时间
线，但 DSH 宿主和浏览器面板无法在 Pi 里运行。把 store 复制进第二个宿主适配器会造
成两个事实来源和两块互不兼容的看板。

## Decision

新增 `packages/pi-godview` 作为第三个公开 workspace 包。它是一个原生 Pi 扩展，既不
是浏览器应用，也不是 DSH bundle：

- 扩展入口通过 `pi.extensions` 声明，包携带 `pi-package` 关键词。它是纯 ESM
  JavaScript，没有构建步骤，只导入 `godview`；从不导入 DSH、Cordis、React 或浏览器
  模块。
- `session_start` 把一个 Pi 会话映射为一个名为 `pi-<hash(sessionId)>` 的看板 agent，
  把 presence 写进仓库的 `.dsh/parallel/`，在 global index 里登记 root，并启动心跳。
  首条用户 prompt 提供那一行 focus。`agent_settled` 把会话标为空闲并释放它的自动租
  约；`session_shutdown` 释放它的租约并留下一行 `done`。
- 扩展注册与 DSH 适配器完全相同的三个工具：`team_status`、`team_roster` 和
  `team_claim`，配普通 JSON Schema。它们作用在同一个 store、同一块按仓库划分的看板
  上。
- Pi 的 `tool_call` 事件守卫 `write` 和 `edit`：其他 agent 持有的生效占用会拦住调
  用；未被占用的仓库内路径会被自动占用。读取、shell 命令和仓库外路径不在守卫范围
  内。
- `/godview` 切换一个针对当前仓库的只读 TUI 组件与状态行，每 2.5 秒刷新一次。v1 没
  有浏览器面板、项目栏、甘特图或协调开关。`/godview off` 只隐藏组件；扩展只要安装
  着就仍在协调。
- `pi-godview` 加入 `godview` 和 `dsh-godview` 所在的 fixed changeset group。它对
  `godview` 的 registry 依赖用的是与 DSH 适配器相同的 `^0.1.0` 版本行，因此两个宿主
  渲染的是同一块看板，而不是两块。

## Alternatives considered

- 在 Pi 里复用 DSH 宿主与浏览器客户端：否决。因为宿主需要 Cordis 和 DSH profile，
  客户端又是浏览器 bundle。那会把一大棵宿主依赖树拖进 Pi，而且照样塞不进 TUI。
- 把 store 分叉进 `pi-godview`：否决。因为 presence、占用、变更和时间线会各自漂移。
  共享的 `.dsh/parallel/` 格式正是 ADR 25 拆分核心的意义所在。
- 先通过 `pi-web` 或 Pi RPC 交付浏览器面板：v1 否决。因为那些是第三方或额外的界面
  面；原生 TUI 组件是最小的可用适配器形态，不需要再起第二个服务器就能验证。
- 做一个全屏自定义 TUI：否决。因为一个组件加一行状态已经回答了谁在活跃、什么被占用、
  什么有变化；自定义屏幕只会增加导航和渲染代码，改变不了看板语义。
- 把适配器放进独立仓库：否决。因为它随 store 一起演进，必须与 fixed group 步调一致
  地发布。

## Consequences

### 验证

- `npm run test -w pi-godview` 通过七个测试：presence 启停、从 prompt 取 focus、冲
  突写入被拒、空闲路径自动占用、三个工具、面板行、扩展注册与包清单。
- `npm test` 通过全部三个 workspace 测试套件，`npm run lint` 通过。
- 包声明了 `pi.extensions` 和 `pi-package` 关键词，依赖 `godview@^0.1.0`，没有任何
  DSH、Cordis、React 或浏览器导入。
- `node --check` 对扩展、session、tools、guard 和测试文件全部通过。
- `npm pack --workspace pi-godview` 产出八个文件：扩展、三个 lib 模块、两份
  README、LICENSE 和 package.json。一个临时 npm 项目安装了该 tarball，解析到
  `godview@0.1.0`，并成功加载扩展；它注册了三个工具和 `/godview`。
- Pi CLI 1.4.0 通过 `pi install` 和 `pi list --approve` 识别了这个本地包。RPC 的
  `get_commands` 返回了 `godview`——无论走显式 `-e` 路径还是走项目包发现。
  `session_start` 写入了一行 `pi-...` presence，关闭后留下 `status: done`。
- 针对 `/godview` 的 RPC prompt 返回 `disposition: handled`，并发出了 `setWidget`
  （key 为 `godview`，两行）和 `setStatus`；TUI 面板路径不经模型即被跑通。
- `adrkit validate --all` 通过，`adrkit relevant` 能就 Pi 包路径检索到本记录。

### 权衡

- Pi 适配器在扩展安装期间保持活跃。与 DSH 宿主不同，它 v1 没有协调开关；用户想停就
  卸载扩展。这是刻意的范围裁剪，不是休眠模式。
- TUI 面板只显示当前仓库。global project index 仍会写入，但 Pi 面板不渲染跨仓库的项
  目栏。
- write/edit 守卫不是沙箱：shell 编辑和 `run_code` 仍在租约体系之外，与 DSH 适配器
  完全一致。
- fixed group 意味着只改核心也会让三个包一起发版。在看板格式共享的期间，这是有意
  为之。
- 核心的 `agentIdForSession` 仍硬编码 DSH 前缀。Pi 适配器选择自行计算 `pi-` id，而
  不动这个通用辅助函数，因此既有的 DSH 看板行保持原 id。
