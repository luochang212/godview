---
status: implemented
date: 2026-11-02
description: 改动发布档案的内容、站点构建或 Pages 基础路径时，先读本记录。
raised-by: human
decided-by: human
created: 2026-11-02
paths:
  - site/**
  - .github/workflows/site.yml
  - AGENTS.md
---

# ADR: 28 站点根路径只发布深色图集

## Problem

发布出去的档案曾同时携带同一批记录的两个版本，外加一个在两者之前先介绍项目的落地
页。那个落地页复述了记录索引、计数和版本说明，它的主要工作就是让读者在浅色 Folio 版
与深色 Signal 版之间做选择。于是每条记录都只能经由一个页面抵达，而这个页面存在的理由
是一个没人需要的选择：所有者读的是深色版，整个站点的唯一目的就是把它打开。

多一个界面面，就意味着多一份要跟记录保持同步的东西。落地页读取的是由 frontmatter 生成
的 JSON 索引，因此某条记录新增字段或改动标题，都可能独立于图集把落地页弄坏。

## Decision

发布的站点就是 adr-kit Signal（深色）图集，别无其他。

`site/scripts/build-archive.mjs` 生成 `decisions/signal.zh.html` 和
`decisions/signal.en.html`，然后把中文图集逐字节复制成 `site/public/index.html`，
于是 Pages 基础路径 `/godview/` 直接服务于图集本身。复制就是复制：发布出去的字节与
`adrkit atlas --theme signal --lang zh` 写出的完全一致，外面不加任何包装、画框或注
入的界面装饰。

落地页、它的布局、它的样式表，以及生成的 `site/src/data/decisions.json` 一并删除。
`site/src` 不再存放任何页面。

Astro 保留为静态构建，但仅作为静态构建保留：它把 `public/` 复制进 `dist/`，并产出
sitemap。它不渲染任何属于自己的页面。sitemap 列出的是 Pages 所服务域名
（`www.luochang.ink`）上的两个真实 URL，而不是 `github.io` 别名。

英文界面保留在 `/godview/decisions/signal.en.html`，可用但不从图集内链接；它的存在
只是为了让英文读者不必被迫使用中文界面装饰。

## Alternatives considered

**保留落地页，从它链接深色版。** 否决：那正是要移除的架构。一个内容只有一个通往图集
的链接的页面就是一跳，而每一跳都是可能过期的东西。

**把图集发布在 `/godview/signal/`，在根上留一个重定向。** 否决：一个 URL 就够的地方
却维持两个，而重定向恰恰是本决定要消掉的那次点击跳转。

**发布两个版本，只删落地页。** 否决：所有者读的是深色版。一个没有读者的浅色版，就是
没有用户的维护。

**去掉 Astro，由构建脚本直接写 `site/dist`。** 暂且否决：Astro 还在承担复制和
sitemap，依赖树与工作流都原封不动；移除它只会为 `site/package.json` 及其锁文件带来
无读者可见收益的折腾。

## Consequences

- `/godview/` 现在直接打开图集。`folio` 页面和旧落地页都不复存在；指向这两个路径的
  书签会 404。
- 发布出去的记录索引和计数随落地页一起消失。读者经由图集自带的目录、时间线和图谱导
  航。
- 少一个需要与记录保持同步的界面面：除了 adr-kit 自己，再也没有东西读取
  frontmatter。
- `astro build` 报告 "0 page(s) built"，并警告 `src/pages` 缺失。这是设计状态，不是
  回归；警告是 Astro 的，构建仍会把图集复制进 `dist/`。
- `site/package.json` 保留它的依赖，包括 `yaml` 和 `@astrojs/sitemap`，尽管已没有任
  何脚本读取它们。它们无害，待锁文件可以重新生成时即可移除。
