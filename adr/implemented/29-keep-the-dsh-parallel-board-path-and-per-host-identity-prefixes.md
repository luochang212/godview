---
status: implemented
date: 2026-11-03
description: 在宿主中立的核心中保留历史性的 .dsh/parallel 看板目录名，并把 agent-id 前缀留在各适配器中而不是核心 API 里。
raised-by: agent
decided-by: human
created: 2026-11-03
paths:
  - packages/godview/lib/store.js
  - packages/godview/bin/godview.mjs
  - packages/dsh-godview/lib/index.js
  - packages/dsh-godview/test/host-smoke.mjs
  - docs/protocol.md
---

# ADR: 29 保留 dsh parallel 看板路径与按宿主划分的身份前缀

## Problem

核心包是宿主中立的：它不得 import DSH、Cordis 或 Pi，而两个适配器读写同一块看板。但核心里仍然留着两处带 DSH 印记的遗留：

- `STORE_DIR` 把看板路径硬编码为 `<repo>/.dsh/parallel/`，于是一个只被 Pi 会话碰过的仓库也会长出 `.dsh` 目录；
- 导出的 `agentIdForSession()` 硬编码了 `dsh-` 的 agent-id 前缀，而 Pi 适配器在旁边自己推导 `pi-` id。

前缀外泄是真正的分层缺陷，目录名却不是：它是记录在案的磁盘契约（docs/protocol.md），`~/.dsh/parallel` 的全局索引也共用这个名字。重命名目录会让所有现存看板成为孤儿，并逼迫一次毫无回报的迁移——agent 根本看不见这个名字，它们能看到的只有面板、工具和 CLI。

## Decision

看板路径保持 `<repo>/.dsh/parallel/`（索引也保持 `~/.dsh/parallel/`），接受它是宿主中立的核心在磁盘上背负的一个历史名称。这不是邀请后续再往核心里添加更多带 DSH 印记的名字。

身份前缀属于宿主，不属于核心 store：核心只保留中立的原语（`hash`、`safeId`），并把传入的 agent id 当作不透明输入。`agentIdForSession()` 从 `packages/godview/lib/store.js` 移出，进入 DSH 适配器，后者一如既往地继续推导 `dsh-<hash>`。Pi 适配器本来就在自行推导 `pi-<hash>`。CLI 的 `join --session` 也在本地继续推导同一个 `dsh-<hash>` id，因为拿一个 session id 加入看板时，必须得到 DSH 宿主会给这个会话的同一身份——CLI 在设计上就是模拟一个 DSH 会话，改它的前缀会把一个会话拆成两行 presence。

## Alternatives considered

- **把看板目录重命名为 `.godview/parallel/`。** 否决：这会破坏所有现存看板和共享索引的布局，换不来任何功能收益，还会让看板格式与项目还是单个 DSH 插件时定下的记录分叉。Git 是唯一的版本（ADR 23）；悄悄地在磁盘上重命名，正是它要避免的不兼容漂移。
- **把前缀做成核心配置项**（`agentIdForSession(sessionId, prefix)`）。否决：这会把一个两个适配器之间的约定变成没人去配置的核心的配置旋钮。前缀对每个适配器只是一个字符串，每个适配器尽可以自行拥有那一行代码。
- **给 CLI 一个 `cli-` 前缀。** 否决：`join --session` 是 CLI 在以 DSH 会话的身份行事，所以它的身份必须与 DSH 宿主为该会话推导的结果一致。另用一个前缀会让同一个会话在一块看板上出现两次。

## Consequences

核心的公开 API 失去了 `agentIdForSession`；两个包同版本联动（ADR 25），且此处尚未发布过任何东西，因此不需要弃用垫片。DSH 适配器自己导出这个辅助函数，宿主冒烟测试也从适配器导入它。只通过 Pi 作业的仓库保留 `.dsh/parallel` 目录名；面板、工具和 CLI 从不把它暴露出来。现在读核心的审查者可以把「宿主中立」按字面理解了，只剩一个点名承认的例外：本记录接受的这个磁盘路径。
