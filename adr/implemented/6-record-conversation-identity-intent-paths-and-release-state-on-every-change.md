---
status: implemented
date: 2026-10-30
description: 修改变更/占用记录的结构、会话归属、intent、释放摘要或看板的身份展示之前请阅读。
raised-by: human
decided-by: human
created: 2026-10-30
paths: [packages/godview/lib/store.js, packages/dsh-godview/lib/index.js, packages/dsh-godview/lib/client.js]
---

# ADR: 6 每条变更都记录会话身份、intent、路径与释放状态

> **由 [ADR 23](23-drop-the-board-protocol-version.md) 修订：** 看板不再携带协议编号，因此文件结构变更随文档和测试一起发布，而不必递增版本号。身份字段与其余决定保持不变。

## Problem

一条只记录路径和持有者的租约，能回答「这是谁占着的？」，却答不上用户真正问过的问题：是哪次会话做出的变更、当时想做什么、涉及哪些文件、已经释放还是仍然开放？

没有会话身份，用户就无法把看板的一行对应回产生它的 DSH 会话。没有 intent，路径只是一个文件名。没有释放状态，一个完成的变更和一个被遗弃的变更看起来一模一样。

## Decision

每个占用都属于一条变更记录。变更记录存储：

- id、agent 和 agentName；
- sessionId 和 sessionTitle；
- intent；
- 所有路径的并集；
- state：claimed、done 或 expired；
- 针对释放或过期的 summary；
- createdAt、updatedAt 和 releasedAt；
- 一条 claim/release/expire 时间线。

占用记录会复制 changeId、sessionId、sessionTitle 和 intent，这样读取者无需通过索引做关联。自动占用从当前关注点取 intent；显式占用使用调用者给出的理由。释放写入 summary；过期写入固定的 summary。

界面展示会话标题与短会话 id、intent、路径和 state/summary。DSH 提供会话标题时就显示标题，否则看板退回使用短会话 id。CLI 和 team_roster 暴露同样的字段。

变更是按会话界定的工作单元；占用是其中的一条租约。一个 agent 同一时间至多只有一个活跃变更。

## Alternatives considered

**只记路径和持有者。** 这足以挡住第二个写入者，却答不出租约属于哪次会话、哪项工作。它把看板降级成了一张锁表。

**在占用上放一条自由格式备注。** intent 有用，但只有备注认不出会话，也认不出释放状态。结构化字段才是可观测性契约；备注只是给人看的摘要。

**用 git commit 作为身份。** Git 对已提交的代码是权威的，但对于有效租约、未提交的工作，或不带提交就释放的工作，它根本不存在。看板必须在提交之前就有用。

**只用 agent 名字。** agent 名字不是会话。多个会话可以重名，subagent 也有自己的会话。sessionId 是稳定的关联，title 是可读的标签。

## Consequences

变更文件变大了；对 CLI 创建的 agent 或旧看板来说，sessionTitle 可能缺失。界面必须用短会话 id 兜底缺失的标题。自动占用的 intent 只和关注点一样精确；显式占用可以携带更好的 intent。

看板如今能回答是哪次会话、什么变更、哪些文件、是否已释放。它仍然无法证明变更的内容：done 只是声明式的释放，不是 commit 或 diff。增加 commit 或 diff 字段将是另一个独立的决策。

身份字段是协议的一部分。修改它们需要递增协议版本号、编写迁移说明，并更新针对缺少 sessionTitle 的旧记录的测试。（已由 ADR 23 废止）
