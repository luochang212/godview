---
status: implemented
date: 2026-11-02
description: 把看板拆分为通用的 godview 核心与 DSH 适配器，从同一个 npm workspace 发布。
raised-by: agent
decided-by: human
created: 2026-11-02
paths:
  - package.json
  - packages/godview/package.json
  - packages/dsh-godview/package.json
  - .changeset/config.json
  - .github/workflows/ci.yml
  - AGENTS.md
  - README.md
  - README.en.md
  - docs/protocol.md
  - packages/godview/lib/store.js
  - packages/godview/bin/godview.mjs
  - packages/godview/test/store.test.mjs
  - packages/godview/README.md
  - packages/dsh-godview/lib/index.js
  - packages/dsh-godview/lib/client.js
  - packages/dsh-godview/cordis.patch.yml
  - packages/dsh-godview/test/host-smoke.mjs
  - packages/dsh-godview/README.md
  - packages/dsh-godview/README.en.md
  - .changeset/README.md
---

# ADR: 25 把通用看板核心与 DSH 插件拆分为一个 npm workspace monorepo

## Problem

仓库目前只有一个可发布的包 dsh-godview，它的根清单混杂了三个关注点：通用的看板
store 与 CLI、DSH 宿主插件与浏览器面板，以及 DSH bundle 元数据。项目现在需要第二
个公开名称 godview，给那些其他 agent、其他宿主在不必导入 DSH 的情况下就能使用的
通用核心。一个 npm 包不能承载两个名字，而把核心复制进第二个包又会制造两个事实来
源。

这次拆分必须在首次公开发布之前完成，因为在那之后，安装路径、包内容和发布顺序都会
变成公开契约。

## Decision

采用 npm workspaces：根私有，两个公开包。

- packages/godview 是通用核心。它持有看板文件格式、store API、无依赖的 CLI 和协议
  文档。它不得导入 DSH、Cordis、React 或浏览器模块加载器。
- packages/dsh-godview 是 DSH 适配器。它持有宿主插件、浏览器面板、bundle patch、
  语言元数据和图标。它依赖 godview，可以导入核心，但核心永远不导入它。
- 仓库根保持私有，存放 ADR 档案、Astro 站点、共享工具和 workspace 锁文件。site/
  仍是自带锁文件的独立项目，不加入 workspace。
- CLI 由 godview 以 godview 之名发布。dsh-godview 不再发布 bin；安装适配器会随其
  依赖把 CLI 一并带入。
- bundle patch 只存在于 packages/dsh-godview，id 与包名保持 dsh-godview。godview
  没有 dsh.bundle，自身不能单独作为 DSH 插件安装。
- 两个包都从 0.1.0 起步。Changesets 用 fixed group 管理后续版本，让核心与适配器
  同步步调。首次 0.1.0 发布是手动的；changesets 从下一次变更开始接管。
- 发布顺序是先 godview、后 dsh-godview，这样适配器的 registry 依赖在安装时即可解析。

## Alternatives considered

- 一个包外加一个 godview 别名：否决。因为它要么复制整个 DSH 插件（两行 bundle、
  两套 API 路由、两个面板 id），要么发布出一个并非真正通用核心的空壳名字。
- 两个独立仓库：否决。因为适配器与核心是一同开发的，在出现第二个消费者之前，跨仓
  库的版本管理必然漂移。
- 把 site/ 纳入 workspace：否决。因为 Astro 项目有自己的依赖树、自己的锁文件和自己
  的 Pages 工作流；嵌套进来只会增加锁文件与 CI 的复杂度，共享不了任何运行时代码。
- 根保持为 DSH 包、另加 packages/godview：否决。因为根仍会是一个发布目标，适配器也
  依然没有干净的包边界。

## Consequences

### 验证

- 根 `package.json` 为私有，声明 `packages/*`，没有 `dsh` 或 `bin` 字段。
- `packages/godview` 打包五个文件：`lib/store.js`、`bin/godview.mjs`、
  `package.json`、`README.md` 和 `LICENSE`。它没有 DSH 清单，也不依赖
  `dsh-godview`。
- `packages/dsh-godview` 打包十个文件：宿主、客户端、bundle patch、语言、图标、
  清单、两份 README 和 LICENSE。它声明 `godview` 为依赖。
- 从根运行 `npm run check` 通过；两个 workspace 测试套件和宿主冒烟测试都经由
  workspace 脚本执行。
- `npm pack --workspace godview` 和 `npm pack --workspace dsh-godview` 均成功。
  一个干净的临时 npm 项目同时安装了两个 tarball，并成功导入了两个包。
- 桌面 profile 的符号链接指向 `packages/dsh-godview`；从 profile 导入适配器时，会
  经由仓库的 workspace 链接加载到 `godview`。
- `.changeset/config.json` 已存在，两个包位于同一个 fixed group；根暴露
  `changeset`、`version-packages` 和 `release` 脚本。首次 0.1.0 发布仍为手动。
- `AGENTS.md`、两份 README、`docs/protocol.md` 和 CI 均已描述新路径。

### 权衡

- 历史 ADR 的行文仍提到 lib/store.js、lib/index.js 和 bin/dsh-godview.mjs。它们的
  `paths:` 元数据已重映射到新的包位置，以保证 `adrkit relevant` 和 `validate` 继续
  可用；行文本身保持历史原貌。
- 桌面 profile 的符号链接从仓库根移到了 `packages/dsh-godview`；正在运行的宿主需要
  重启或改动 patch 时间戳，才会加载新路径。
- npm 无法包含包目录之外的文件。每个包各自携带 README 和 LICENSE，适配器的 tarball
  不再附带 `adr/` 或 `AGENTS.md`。
- 在 `godview` 登上 registry 之前，对 `packages/dsh-godview` 做本地路径的
  `dsh plugin add` 会失败，因为依赖写的是 registry 版本范围。workspace 符号链接是
  开发路径；首次发布必须先发布 `godview`，再发布 `dsh-godview`，然后在临时 profile
  里安装适配器。
- fixed group 的版本把两个包耦合在一起：只改核心也会触发适配器发版。在适配器是唯一
  消费者的这段时间里，这是有意为之。

