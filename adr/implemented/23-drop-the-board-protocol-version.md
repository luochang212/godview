---
status: implemented
date: 2026-10-31
description: 修改看板文件结构或考虑 schema 版本时请阅读本记录：看板不携带协议编号，Git 是唯一版本。
raised-by: human
decided-by: human
created: 2026-10-31
paths: [packages/godview/lib/store.js, packages/dsh-godview/lib/index.js, packages/dsh-godview/lib/client.js, docs/protocol.md, AGENTS.md, README.md, README.en.md, packages/godview/test/store.test.mjs, packages/dsh-godview/test/host-smoke.mjs]
---

# ADR: 23 移除看板协议版本

## Problem

看板带有一个 `protocol: 3` 标记。每次写入 presence、占用和变更都会盖上它，只要标记不一致，`ensureStore` 就重写 `config.json`；两份 README 都展示着 protocol-3 徽章；AGENTS.md 还要求任何不兼容的文件结构或路由都要递增版本。

全局项目索引和协调开关也带着同样的死模式 `version: 1`:每次更新都写，从来没人读。

唯一的读者就是本仓库自己的宿主、CLI 和面板。没有外部实现者、注册中心或握手协议需要协商。在 Git 之外再造一个版本号，回答的是一个没人问的问题，还平白制造工作：每次结构变动都要递增版本、写迁移说明、为旧记录补测试，而真正负责兼容的代码（回退时间线、被忽略的消息目录）从来不看这个数字。删掉那些无人使用的看板写入 HTTP 路由时，裂缝露了出来：标记只存在于文件里，拿它去给 HTTP 定版本，就只能在虚增一次版本和给规则开口子之间二选一。

## Decision

看板没有协议版本。看板文件不再携带 `protocol` 字段；`config.json` 创建时只有 `createdAt`、`createdAtIso` 和 `note`;`snapshot` 不再返回 `protocol`。注册表索引和协调开关也不再写 `version`。`docs/protocol.md` 在不带版本号的前提下记录文件结构、HTTP 接口面和兼容行为。Git 是唯一版本：文件结构或路由的变更，连同相应的文档与测试在同一个 commit 内一起交付，包版本则向仓库之外的人传达兼容性。现有文件中的未知字段一律忽略，旧的消息目录可以删除，缺失的时间线由 `createdAt`/`releasedAt` 合成。

边界：这次移除的是版本标记，不是兼容处理。宿主仍然读取旧看板文件，不需要任何数据迁移。

## Alternatives considered

**保留 3，并借路由删除递增到 4。** 已否决：这个标记是给看板文件定版本的，而文件结构没有任何变化。递增版本会重写每一份 `config.json`，宣告一种它并不会写入的格式，还会让规则在下一次路由变更时依然是错的。

**保留 3，为路由加一条规则例外。** 已否决：一个作用域需要在 AGENTS.md 里加注脚说明的版本字段，还不如干脆没有。规则存在的意义是保护读者，而这个仓库之外根本没有读者。

**用 semver 字符串或 schema URL 取代 3。** 已否决：那仍是要维护的第二套版本，而且没有消费者。Git 已经记录了每一种结构，包版本也已经标明了各个发布。

**保留字段但不再检查它。** 已否决：一个死掉的字段只会引诱读者去信任它。

## Consequences

每次结构变更的开销更小：不用递增版本，不用迁移章节，不用钉死某个数字的测试。文件变薄了，文档也不再暗示存在对外规范。代价是：读过 `protocol` 或按这个数字分支的外部脚本会失去这个信号，`snapshot.protocol` 也从 `/state` 和 `--json` 里消失。仓库内没有任何东西消费过它。旧的 `config.json` 在被重建之前会保留一个人畜无害的 `protocol` 字段，未知字段会被忽略。若未来的格式真的需要兼容开关，到那时再让它带着真实的消费者和真实的迁移回来即可。
