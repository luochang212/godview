---
status: implemented
date: 2026-10-31
description: "写入守卫只有一种策略：write/edit 自动占用并拒绝仍然有效的冲突。claimPolicy 及其 require/advisory/off 取值已经移除。"
raised-by: agent
decided-by: human
created: 2026-10-31
paths: [packages/dsh-godview/lib/index.js, packages/godview/lib/store.js, docs/protocol.md, README.md, README.en.md, examples/cordis.patch.yml, packages/dsh-godview/test/host-smoke.mjs]
---

# ADR: 22 写入守卫只保留一种策略：auto

## Problem

ADR 7 交付写入守卫时带了一个 `claimPolicy` 旋钮：`auto`、`require`、`advisory` 或 `off`。评审中暴露出三个问题：

- 用户根本够不到这个旋钮。它是 profile 配置里的安装期取值，面板只暴露协调开关。无人可及的配置就是文档债和测试面。
- `advisory` 兑现不了自己的承诺。宿主的 `tools/pre-execute` 契约里没有"放行时附带提示"的通道（`allow` 不携带任何字段），所以在冲突发生的那一刻，"只警告、不拦截"根本无法实现。唯一真正可用的通道是环境性的提示词上下文——而 `promptFor` 在每种策略下本来就渲染它。
- `off` 以更细的粒度重复了协调开关，于是"别来烦我"有了两种表达，却无从判断实际生效的是哪一种。

## Decision

守卫策略只有一种，就是 ADR 7 的 auto 行为：write/edit 为当轮自动占用目标，他人持有的有效占用会以一条可操作的消息拒绝本次写入，自动占用在空闲时释放；`claimPolicy` 配置键不复存在。协调开关仍然是整个功能的唯一关闭按钮。`team_claim` 继续可用，用于有计划的显式租约。

## Alternatives considered

**保留 `require`。** 它强制在任何写入之前声明意图，能减少无用功。它落选是因为依赖 agent 的自觉：忘记占用就要吃一次拒绝，而对 LLM agent 来说，忘记才是常态。auto 在工具边界上强制执行，不需要 agent 配合，而且它的拒绝在第一次写入尝试时就触发——那已是冲突能够被暴露的最早时刻。竞态安全来自独占（`wx`）的占用文件创建，不靠时机或自觉。

**保留 `advisory`，只作环境提示。** 提示词上下文在每种策略下都已经列出他人持有的文件，advisory 增加的只有"不强制执行"这一点。一个唯一行为就是"比默认更弱"的模式不该存在。

**保留旋钮以备未来之需。** 场景只有一种：agent 在同一仓库的文件上相撞。真有全新需求出现时，Git 会替我们留着被删掉的分支。一个没人够得到的配置键不是灵活性，只是暴露面。

## Consequences

守卫、文档和测试从此描述一种行为，而不是四种。`promptFor` 的协议行丢掉了四路分支。冒烟测试删去了第二运行时的 advisory 部分。移除 `require` 的"未占用即拒绝"消息和 `advisory` 的提示措辞，也消除了这些文本与现实脱节的风险。
