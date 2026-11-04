---
status: implemented
date: 2026-11-03
description: 下架已废弃的 dsh-god-view 与 pi-god-view 包，让 npm 的相似名规则放行 dsh-godview 与 pi-godview；并修正 ADR 27 中「从未发布」的前提。
raised-by: agent
decided-by: human
created: 2026-11-03
paths:
  - adr/implemented/27-rename-the-project-to-godview-and-its-adapters-to-dsh-godview-and-pi-godview.md
  - packages/dsh-godview/package.json
  - packages/pi-godview/package.json
---

# ADR: 30 下架改名前的旧包以释放新名称

## Problem

ADR 27 把适配器改名为 `dsh-godview` 和 `pi-godview`，前提是旧名字「从未发布到任何 registry」。这个前提是错的：`dsh-god-view@0.1.0`、`pi-god-view@0.1.0` 和 `godview@0.1.0` 全都在 2026-11-01 发布过，也就是改名记录落档的前一天。

这次发布在新名字下的首次 release 时才暴露。npm 的相似名规则会阻止名字与已有包过于接近的新包，并且不论归属，于是 `dsh-godview` 和 `pi-godview` 被 403 拒绝，而 `godview@0.2.0`（与任何名字都不相似）发布成功。

## Decision

把两个背负已废弃旧名字的包整体下架，从而清除 ADR 27 所选名字上的相似度阻拦。这两个包符合条件：各自都在 72 小时的下架窗口内发布；都属于本项目维护者；且在 registry 中没有任何依赖方——它们从未被写进文档、从未被依赖，ADR 27 也早已废弃这两个名字。

`godview` 保持原样：它仍在使用，名字与谁都不相似，其 0.1.0 是改名前核心的一次真实 release。核心保留它的无 scope 名字，适配器保留各自的名字，ADR 27 的选择原封不动。变的只有事实记录——ADR 27 的「从未发布」说法在本记录中被更正，而不是去编辑那条记录。

关于 registry 产物的说明：npm 的 2FA 浏览器发布流程会先把 tarball 以 `0.0.0-stage` 暂存，再定稿真实版本。两个适配器包都正常定稿，其暂存版本已被下架。`godview` 的暂存版本 `0.0.0-stage` 无法下架（该包如今在 registry 中已有依赖方），因此改为标记弃用并指向 0.2.0。它是发布流程的暂存产物，不是 release。

## Alternatives considered

- **给适配器加 scope**（`@luochang212/dsh-godview`）。在确认旧包可以删除后即被否决：npm 自己也建议用 scope 绕开相似名规则，但 scope 会改掉 ADR 27 刚刚定下的面向消费者的名字，撕裂这个包家族的风格，而且阻拦一旦清除它就分毫收益都没有。
- **继续用旧名字发布。** 否决：这会推翻 ADR 27，并把拆词拼写 `god-view` 重新引入，而那条记录存在的目的正是消除这种拆分。
- **让旧包保持已发布。** 否决：新名字会永远无法发布，逼人只能在加 scope 和第三次改名之间二选一。

## Consequences

`godview`、`dsh-godview` 和 `pi-godview` 现在都按 ADR 27 选定的名字发布，registry 不再承载那些被废弃的拼写。这次下架是不可逆的——将来若有适配器想要收回 `dsh-god-view`，就得去找 npm 支持。对 `godview@0.0.0-stage` 这个产物选择标记弃用而非下架，意味着核心的包历史里会留下一个可见但已被标记的版本。

ADR 27 的 Problem 一节写着旧名字从未发布；本记录更正这一点。改名本身未受影响。
