---
status: implemented
date: 2026-10-31
description: 修改甘特图、面板的内容分区，或任何会把事件列表重新加回时间线下方的改动时阅读。
raised-by: human
decided-by: human
created: 2026-10-31
paths: [packages/dsh-godview/lib/client.js, packages/dsh-godview/test/client-locale.test.mjs]
---

# ADR: 14 只展示甘特图，并把精确时间移入条形悬浮提示

## Problem

甘特图下方原先挂着一个可折叠列表，罗列每一条 claim、release 与 expire 事件。它重复了条形本身已经编码的信息：每个事件一行，顺序与上方泳道一致。它是甘特图下方唯一的内容，于是内容区以一面文字墙收尾，每次浏览都得用眼睛跳过它。

它承载的精确时间本来就有出处：每个条形在悬停和键盘聚焦时都会弹出定位好的悬浮提示，包含文件、操作者、开始、结束、时长与 intent/summary。不截断的完整记录保存在看板文件和 CLI 里。

## Decision

面板不再渲染事件列表。在浏览器 bundle 中，甘特图是唯一的时间线界面：`TimelineSection`、`<details>` 块、扁平化的时间线数据以及 `.pt-timeline` / `.pt-tl-*` 样式全部移除。

分区说明现在写着 "bars run from claim to release; hover a bar for exact times"。悬浮提示保留文件、操作者、start/end、时长与 intent/summary；条形保持可聚焦，因此同样的数值通过键盘也能取到。

这取代了 [ADR 3](3-model-occupancy-as-a-claim-release-timeline-rendered-as-a-per-file-gantt.md) 中 "keep an exact-time detail list available under the details element" 的条款，也取代了 [ADR 10](10-treat-the-panel-as-an-app-shell-with-logo-rail-topbar-and-scrolling-content.md) 里的 "exact-time details" 与 "read-only note" 两项：内容现在以甘特图收尾，而只读是结构性的（没有任何输入框），不再是一行说明文字。占用/释放时间线仍然是模型，只是从两种呈现变成了一种。

## Alternatives considered

**保留列表、默认折叠。** 它本来就是折叠的，代价不在展开状态，而在于页面最后一块是一个产品并不鼓励打开的折叠区，而且任何打开它的人看到的都是条形的重复信息。

**做成模态框或标签页。** 已否决：为条形已经能回答的数据再引入第二个界面和第二个控件。

**只保留一个事件计数。** 已否决：甘特图的区间计数已经给出了这个数字。

## Consequences

- 内容区现在以甘特图收尾，页面因此更短，这条唯一的时间线也成了显而易见的阅读对象。
- 精确时间只需一次悬停或一次 Tab 聚焦，不再需要滚动加展开，屏幕阅读器用户从被聚焦的条形上就能获得这些信息。
- 完整的事件记录在磁盘和 CLI(`godview changes`)中均未改变，协议也没有动。
- 一旦 `TimelineSection`、`事件明细` 或 `pt-tl` 样式重新出现，`test/client-locale.test.mjs` 就会失败，因此这份列表不可能悄无声息地回归。
