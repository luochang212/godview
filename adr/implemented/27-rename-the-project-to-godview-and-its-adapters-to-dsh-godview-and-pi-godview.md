---
status: implemented
date: 2026-11-02
description: 重命名仓库与适配器包，让品牌、核心包和两个适配器的名字都拼成同一个 godview。
raised-by: human
decided-by: human
created: 2026-11-02
paths:
  - package.json
  - package-lock.json
  - .changeset/config.json
  - packages/dsh-godview/package.json
  - packages/dsh-godview/cordis.patch.yml
  - packages/dsh-godview/lib/index.js
  - packages/dsh-godview/lib/client.js
  - packages/pi-godview/package.json
  - packages/pi-godview/extensions/pi-godview.js
  - examples/cordis.patch.yml
  - site/astro.config.mjs
  - site/scripts/build-archive.mjs
  - README.md
  - README.en.md
  - AGENTS.md
  - docs/protocol.md
---

# ADR: 27 把项目更名为 godview，适配器更名为 dsh-godview 与 pi-godview

## Problem

项目起初是一个名为 `dsh-god-view` 的单一 DSH 插件，仓库也按这个适配器命名。随后
ADR 25 从插件中拆出了宿主中立的核心（`godview`），ADR 26 又为 Pi coding agent 加了
第二个适配器。项目今天是一块带一个通用核心和两个适配器的看板，但它的名字仍在描述第
一个适配器：仓库叫 `dsh-god-view`，两个适配器把产品拼成 `god-view`，而核心包拼的是
`godview`。

这种拼写分裂就是具体的缺陷。生态惯例是在 `<platform>-<brand>` 式命名里保持品牌自身的
拼法（`tailwindcss-animate` 跟着 `tailwindcss` 走，而不是 `tailwind-css`）；因此
`dsh-god-view` 宣称了一个叫 "god view" 的品牌，而这个品牌在其他任何地方都已不存在。

## Decision

品牌是 `godview`，处处拼成一个词。仓库是 `godview`；三个 npm 包是
`godview`（核心）、`dsh-godview`（DSH 适配器）和 `pi-godview`（Pi 适配器）。适配器
命名保持平台在前的模式，并保持品牌完整。

旧名字 `dsh-god-view` 和 `pi-god-view` 直接废弃，不做别名。它们从未发布到任何
registry，所以这次更名不发布 deprecation 声明，也不提供兼容包。

由包名派生的名字随之迁移：

- DSH 插件 id 和 HTTP 路由前缀变为 `dsh-godview` 与 `/plugins/dsh-godview/api`；
- 项目栏的浏览器存储键变为 `dsh-godview:rail`；
- 包的 `repository`/`homepage` URL 指向 `godview` 仓库；
- ADR 档案发布在 Pages 基础路径 `/godview/`。

面板本身的文案不变：侧边栏条目仍是 上帝视角 / God's Eye，看板仍是只读的协调界面。

## Alternatives considered

- **保留 `dsh-god-view` 和 `pi-god-view`。** 否决：这些名字编码了项目已不再使用的品
  牌拼法，而且按它命名的仓库本身正在更名。
- **改用 `godview-dsh` 和 `godview-pi`。** 否决：虽然一致，但它颠倒了现有每个适配器
  名字和文档都在用的平台在前顺序，除了更名本身之外换不来任何收益。
- **发布新名字并把旧名字标记弃用。** 否决：旧名字从未发布过任何东西，deprecation 只
  会指向一个根本不存在的包。
- **包改名的同时给旧目录路径留别名。** 否决：一个 workspace 成员配两个名字，恰是这
  个决定要消除的漂移。

## Consequences

对已经把 DSH profile 指向 `dsh-god-view` 的人来说，这次更名是破坏性的：profile patch
行和 `node_modules` 链接都必须迁到 `dsh-godview`，宿主必须重启，面板才会重新出现。
曾收起项目栏的浏览器会把它强制展开一次，因为存储键变了。ADR 档案旧的
`/dsh-god-view/` 地址停止解析；GitHub Pages 不会重定向项目路径。

仓库从此一个品牌只有一个拼法：仓库、核心包、两个适配器、插件 id 和发布的档案全部一
致。版本号不动：`0.1.0` 从未以旧名字发布过，所以这次更名是命名变更，不是一次发布。
