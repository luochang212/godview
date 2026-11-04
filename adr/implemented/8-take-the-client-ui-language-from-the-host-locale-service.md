---
status: implemented
date: 2026-10-30
description: 修改 lib/client.js 选取界面语言、添加标签或注册侧边栏元数据的方式之前请阅读。
raised-by: agent
decided-by: agent
created: 2026-10-30
paths: [packages/dsh-godview/lib/client.js, packages/dsh-godview/test/client-locale.test.mjs, packages/dsh-godview/test/ui-lang.cjs]
---

# ADR: 8 客户端界面语言取自宿主的 locale 服务

## Problem

看板曾在浏览器 bundle 求值的那一刻，从 `document.documentElement.lang` 一次性选定语言。宿主把该属性以静态的 `en` 提供，只有在它的 locale 插件解析出当前语言之后才会重写。在桌面端，这个解析是一次异步的原生读取。因此冷启动时可能先求值了 bundle，把整个看板冻结在英文，而应用其余部分是中文；又因为这个值被固化进了模块常量，后来的语言切换根本无法传到面板。

上报的症状是：侧边栏入口写着 `Agents`、面板写着 `Agent Team`，而周围的界面都是中文，且只在部分启动时出现。

## Decision

浏览器 bundle 把 `locale` 声明为注入服务之一，从 `ctx.locale.getSnapshot()` 读取当前语言，并通过 `ctx.locale.subscribe` 订阅，使已打开的面板能在语言变化时重新渲染。`L()` 仍然是唯一的标签助手，所有标签都在渲染时计算，`useChinese()` 让组件订阅共享的语言值。

注入同时规定了激活的顺序：插件现在只在 locale 服务存在之后才 apply，因此首次注册之前语言就已确定，任何标签都不会基于解析前的文档状态生成。

侧边栏入口的标签是静态的注册元数据，而不是渲染出来的内容，因此 `apply()` 会在语言变化时重新注册该入口；面板主体不需要这一步。

`document.documentElement.lang` 只作为 apply 之前的兜底保留，服务于在插件生命周期之外渲染 bundle 的宿主。渲染路径不得读取它；`navigator.language` 也不得决定语言：它描述的是这台机器，不是用户选定的界面语言。

## Alternatives considered

**渲染时读取 `<html lang>` 并用 MutationObserver 跟随变化。** 只要宿主持续同步该属性就能工作，但它把文档属性当成了语言权威，而恰恰是这个属性在 bug 上报时是陈旧的。

**只用 `navigator.language`。** 稳定且简单，但只要选定的界面语言与系统语言不同就会出错，而这是一种受支持的配置。

**永远双语标签（「协作台 / Agents」）。** 消除了语言交替，但屏幕上每个标签都翻倍，也抛弃了仓库的 `L()` 约定。

**向宿主的 locale 运行时注册词典，再通过 `t()` 渲染。** 这是 DSH 支持多语言的惯用路径，但本看板只发布两种语言，也不需要命名空间类型；词典层只会增加机制，却不改变行为。

## Consequences

冷启动第一次显示的就是所选语言，已打开的面板能在不刷新页面的情况下跟随语言切换。插件现在要求宿主提供 `locale` 客户端服务：对于从不提供它的宿主，插件不会激活。这是有意为之。没有这个服务，语言就没有权威来源，而靠猜测正是当初产生这个 bug 的原因。

回归覆盖在 `test/client-locale.test.mjs` 中：它用一个带着陈旧 `en` 文档和 `zh` locale 的假宿主驱动真实的 bundle，同时断言标签重注册与渲染时的标签；还有 `test/ui-lang.cjs`：它对着运行中的宿主复现延迟原生桥接下的桌面冷启动。

每次语言变化时，侧边栏入口都会被销毁并重新注册；注册表从不就地修改标签，因此这条记录也说明了为什么要重新注册入口，而不是就地编辑它。
