---
status: implemented
date: 2026-10-30
description: 在向看板添加任何消息、收件箱、提问、回复或人工输入界面之前先阅读本记录。
raised-by: human
decided-by: human
created: 2026-10-30
paths: [packages/godview/lib/store.js, packages/dsh-godview/lib/index.js, packages/dsh-godview/lib/client.js, packages/godview/bin/godview.mjs]
---

# ADR: 2 去掉 agent 之间的消息，保留关注点、占用与时间线

> **由 [ADR 23](23-drop-the-board-protocol-version.md) 修订：** 看板不再携带协议编号，因此本记录中的 "Protocol 3" 只是历史，不是需要升级的版本。移除消息这一决定依然有效。

> **被 [ADR 17](17-put-the-rail-on-the-right-collapse-it-to-zero-and-borrow-host-chrome.md)
> （2026-10-31）部分取代。** 「Refresh 是唯一的操作按钮」这一说法已不再成立 —— 现在没有刷新按钮，面板上恰好只有两个控件（协调开关与项目栏折叠开关）。

## Problem

早期版本加入过直接消息，带有 needsReply、pending/read 状态、reply_to、TTL，以及一个「Agent questions」区块。这个特性在文件租约之外长出了第二套状态机：一条消息可能被送达、已读、已回复、过期或滞留；UI 需要一个收件箱，面板还需要一套关于人工输入的叙事，尽管核心看板本应由 agent 操作、保持只读。

它既没有防止文件冲突，也没有改进占用时间线。它还模糊了两个不同的概念：关注点是会话在当前时刻的属性，而提问是一个带有回答生命周期的事件。两者并存引出了一个疑问：「一行关注点为什么需要回复?」，还让面板看起来像个聊天产品。

## Decision

看板没有消息子系统。没有 team_send，没有收件箱，没有 needsReply，没有已读状态，没有 reply_to，也没有消息 TTL。运行时恰好暴露三个工具：team_status、team_roster 和 team_claim。

关注点是当前会话在当前时刻的属性。它来自第一条用户/subagent 提示词，可以通过 team_status 更新，它没有回复状态，也没有生命周期。

浏览器面板是只读的。没有撰写框、消息框、回复框或问题队列。项目行是导航，Refresh 是唯一的操作按钮。

如果 agent 之间需要彼此给出决定，它们使用现有的 DSH 会话对话，或把相关意图写进当前关注的占用里。看板本身不承载对话。

Protocol 3 把消息从存储和 HTTP 接口中移除。旧的消息目录会被忽略，可以删除，在线状态、占用和变更依然有效。

## Alternatives considered

**保留消息，只隐藏 UI 区块。** 队列、送达、TTL 和回复状态依然存在，照样需要测试和文档。把第二套状态机藏起来并不能消除它的代价。

**只保留 FYI 消息。** 即使没有 needsReply，一条消息仍然需要收件人、送达、已读标记和删除规则。它仍然是一个收件箱，只是更安静而已。

**把提问写进关注点字符串。** 这在承认「关注点是属性」这一点上是诚实的，但它不是一个能被持久回答的提问；agent 已经能看到关注点和占用意图。专门的对话属于会话，不属于某个属性字段。

**在占用上加一个 note 字段。** 这对记录意图有用，而占用理由已经覆盖了这一点。它不是对话，不能成为回复/已读状态的理由。

**把消息放进全局项目索引。** 全局索引只做聚合，没有按仓库的写入路径。把它变成消息总线，会让项目发现依赖于聊天送达。

## Consequences

看板变得更小，其状态模型也更好解释：在线状态、占用、变更、时间线。没有滞留的提问，没有未读角标，也没有人工输入的歧义。代价是看板不能作为跨 agent 的决策通道，这一能力必须来自会话或未来某个显式的特性，而不是关注点。

测试、文档、CLI 命令和 HTTP 路由不得在没有任何取代本决定的新决定的情况下重新引入消息。只读控件断言（inputs/selects/textareas 数量为零）是契约的一部分。

旧的 v2 消息不做迁移。它们在当前模型之外，不应影响占用或时间线行为。
