---
status: implemented
date: 2026-10-31
description: 修改什么算活跃项目、近期程度如何计算，或项目栏如何标注会话与活动时阅读。
raised-by: human
decided-by: human
created: 2026-10-31
paths: [packages/godview/lib/store.js, packages/dsh-godview/lib/index.js, packages/dsh-godview/lib/client.js, packages/godview/test/store.test.mjs, packages/dsh-godview/test/client-locale.test.mjs, docs/protocol.md, README.md, README.en.md]
---

# ADR: 16 将活跃定义为近期工作，而非宿主存活

## Problem

项目栏在有存活的 presence 或存活的租约时就把看板称为 "active"(ADR 11)，而 presence 统计任何未 stale、且 status 不为 `done` 的 agent。听起来合理，直到你去看心跳究竟是什么：同一个桌面宿主里每个被跟踪的会话都由同一个计时器刷新，侧边栏没有 "close conversation" 操作，而 `done` 只在会话销毁时发生。于是只要应用开着，每个会话都是 "online"，包括几小时前就被弃用的对话。计数在一行标着 "idle" 的旁边显示 "2 active"，而 `lastActivityAt` 取的是心跳的最大值，于是两小时前就停下的工作会永远显示 "1s"。

代码度量的是宿主，而不是对话。"Online" 既是用错了词，也是筛错了对象。

## Decision

把这些信号拆开，并且只给其中恰好一个设定时间窗口：

- **存活**：心跳 + TTL。仅用于剔除来自已死宿主的行。绝不作为活动展示，也绝不计入 "active"。
- **活动**：presence 上的 `updatedAt`，加上占用与变更的时间戳。一次用户/子代理 prompt、一个回合的起止、一次工具结果、一次占用或一次释放都会推动它。心跳不会。
- **工作**: `status = active | idle | blocked | done`。事件驱动，没有时间窗口。
- **占用**：一份存活的租约。与 presence 相互独立。

满足以下任意一条，项目即为 **active**:

1. 有存活的会话处于 `active` 或 `blocked`;
2. 它有存活的租约；
3. 最近一次活动发生在 **30 分钟**以内（`ACTIVE_WINDOW_MS`）。

否则它就是空闲，项目栏将其隐藏，没有任何活跃项目时，面板显示空白页（ADR 11）。

`lastActivityAt` 现在表示活动，而不是心跳。`projectSummary` 在 `claims` 之外同时暴露 `working` 与 `blocked` 计数。UI 不再用 "online"/"活跃" 描述会话数量：页脚和卡片头部写 **会话 / 进行中**，项目行写 **进行中 · 受阻 · 占用 · 变更**，再加上最近一次活动的时间。

项目圆点表达的是工作状态，不是存活状态：会话工作中为**呼吸的绿色**，受阻为**红色**，仅被占用为**琥珀色**，看板近期活跃但无人工作、无人持有时为**灰色**。在 `prefers-reduced-motion` 下动效停止；title 文案携带同样的状态。

这取代了 [ADR 11](11-list-active-projects-only-and-give-an-empty-board-one-quiet-blank-page.md) 中 "active = live presence" 的条款，以及 [ADR 10](10-treat-the-panel-as-an-app-shell-with-logo-rail-topbar-and-scrolling-content.md) 里 "active-session" 的页脚措辞。ADR 11 的"只列活跃项目"与"安静的空白页"仍然成立。

## Alternatives considered

**只列出工作中或受阻的会话与占用。** 这是对 "active" 最严格的解读，会把项目栏变成实时活动监视器。已否决：`status` 在每个回合边界都会翻转，你正在看的看板会在其 agent 结束一个回合的瞬间消失，一个仍然开着、仍有用的空闲会话会变得无法触达。项目栏是导航，不是 CPU 仪表。

**保留 presence，另加一个 "working" 标记。** 这正是修正标签之前代码的做法。已否决：计数仍会把一个被弃用的对话算作活跃，`lastActivityAt` 仍会把心跳显示成 "1s"。光改名只会掩盖这个 bug。

**只用 "recent activity"，不设进行中或受阻状态。** 已否决：一个长回合若没有产生工具结果，过了窗口就会消失，而受阻的 agent 恰好在最需要人关注的 30 分钟之后退出列表。

**另设一个空闲超时，把搁置的会话标记为 done。** 目前否决：它需要又一个时钟，会写入更多 presence 抖动，而 TTL 已经处理了已死的宿主。放着不动的会话允许空闲，只是不能被称作活跃。

## Consequences

- 一个 30 分钟没有任何动作的对话，即使宿主存活也会离开项目栏。发送一条 prompt 就能让它立刻回来，它的完整历史仍保存在 CLI 里。
- `lastActivityAt` 现在是有用的排序键和悬浮提示内容，数值不再每 20 秒跳动一次。
- 被选中的看板可能在 30 分钟边界处退出，选择逻辑遵循 ADR 11(第一个活跃看板，否则回到空白页)。
- `/projects` 和 `/state` 新增了附加字段 `working`(汇总中还有 `blocked`)。为兼容起见，`active` 仍是存活且非 done 的会话计数，但 UI 不再把它呈现为 "active"；文档改称其为 sessions。
- 30 分钟窗口是产品常量，不是按 profile 配置的设置。若定义变更，需在这里与 `ACTIVE_WINDOW_MS` 同步修改。
- 这次变更后必须重启宿主（仅刷新页面不够），因为汇总是在宿主进程里计算的。
