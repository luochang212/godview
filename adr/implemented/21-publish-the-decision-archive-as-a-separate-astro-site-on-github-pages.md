---
status: implemented
date: 2026-10-31
description: 修改已发布的决策档案、其 Astro 站点或 GitHub Pages 工作流时请阅读本记录。
raised-by: human
decided-by: human
created: 2026-10-31
paths: ['site/**', '.github/workflows/site.yml']
---

# ADR: 21 将决策档案作为独立的 Astro 站点发布到 GitHub Pages

## Problem

本仓库的决策此前只能通过 CLI 阅读，或在 GitHub 上以原始 Markdown 的形式查看。adr-kit 可以渲染一份决策图谱，但项目没有把它发布出去的载体。插件刻意不带构建步骤、也不带运行时依赖，因此把 Astro 加进根包，会让一个可安装的插件与静态站点工具链耦合在一起。

## Decision

档案存放在 `site/` 下的一个私有 Astro 项目里。插件包保持无依赖的运行时。

`site/scripts/build-archive.mjs` 在 `astro dev` 和 `astro build` 之前运行。它按主题与语言的两两组合（`folio` 与 `signal`，中文与英文）各生成一次、共四次 adr-kit 图谱，写入 `site/public/decisions/`，并从记录的 frontmatter 与标题生成 `site/src/data/decisions.json`。Astro 在 Pages 的 base path `/godview/` 下渲染一个落地页，并把图谱页面作为静态文件复制过去。

`.github/workflows/site.yml` 里的 GitHub Pages 工作流在涉及 `site/`、`adr/`、依赖清单或工作流本身的推送上运行。它会安装根依赖、校验记录、安装站点依赖、构建 `site/dist`，并用 `actions/deploy-pages` 部署该目录。Pages 使用 GitHub Actions 作为部署源，而不是分支。

生成的图谱 HTML 和 `site/src/data/decisions.json` 都不提交入库。两者在每次构建时都从当前记录重新生成。

## Alternatives considered

**提交生成的图谱 HTML。** 已否决：它把每条记录复制一遍，会悄无声息地过期，还把发布页面钉死在最后跑过一次构建的那个 commit 上。

**不用 adr-kit 图谱，而是把记录渲染成 Astro 内容页面。** 已否决：那等于重新实现 adr-kit 已经维护好的目录、时间线、决策地图和阅读器，而且记录格式一变就会跟着跑偏。

**把 Astro 加进根包。** 已否决：插件运行时要保持无依赖、无构建，发布的包也不该携带只有站点才需要的依赖。

**只发布图谱、不做落地页。** 已否决：图谱默认读者已经了解这个项目。封面页承载项目背景、记录索引，以及主题与语言的选择。

## Consequences

- 每次相关推送都会重新发布档案。插件的安装、测试与运行路径不变。
- 仓库现在有两棵依赖树：根目录的 `npm ci` 安装 adr-kit,`site/npm ci` 安装 Astro。pre-commit 钩子仍然只检查根目录。
- 构建依赖 adr-kit 的 CLI 输出，以及 frontmatter 的 `description`、`date`、`paths` 字段。记录格式一变，就必须同步更新 `site/scripts/build-archive.mjs`。
- 发布的图谱钉在构建所在的 commit 上，图谱页脚和记录源码链接都指向那个 commit。
- `site/` 被排除在 npm 的 `files` 列表之外，发布的包因此保持小巧。

### Later changes

**Amended by ADR 28:** 站点只发布深色 Signal 图谱，中文版直接复制到 base path 根目录，落地页、Folio 版本和主题选择都已移除。Astro 托管在 Pages 上的流水线、独立的依赖树，以及生成的 HTML 永不入库的规则依然成立。
