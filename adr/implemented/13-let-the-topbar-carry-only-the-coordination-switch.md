---
status: implemented
date: 2026-10-31
description: 修改面板顶栏、协调开关或头部的状态指示时阅读。
raised-by: human
decided-by: human
created: 2026-10-31
paths: [packages/dsh-godview/lib/client.js]
---

# ADR: 13 让顶栏只承载协调开关

> **被 [ADR 17](17-put-the-rail-on-the-right-collapse-it-to-zero-and-borrow-host-chrome.md)
> （2026-10-31）部分取代。** 顶栏仍然只承载开关，但这里描述的 34x20 自绘滑轨，已被换成对宿主自己的 36x20 Switch 的一份复刻。

## Problem

顶栏右侧原先放着两样东西：一个 "live" 指示器（一个圆点加上 实时 字样，首次请求还在途中时显示 连接中），以及一个前面带 协作 字样的协调开关。两者都在重复页面本身已经携带的信息：

- 项目栏为每一行提供状态圆点，而这才是本面板真正关心的唯一状态；
- 开关是全局的，也是唯一的控件，它自身的位置和颜色已经说明了协调是否开启；
- 在一个滑块前面加 协作 字样，读起来像设置表单里的字段标签，而这里并不是那种表单。

与此同时，顶栏是整套 UI 中最安静的一条区域。把它花在多余的圆点和多余的文字上，只会让面板看起来比它背后的看板更喧闹。

## Decision

顶栏右侧只承载一个元素：开关。它保留 role=switch、aria-checked、data-coordination=on|off|unavailable 和 34x20 滑轨，去掉可见标签，并加上 aria-label="协作开关"，让屏幕阅读器仍能读到这个控件的名称。

"live" 指示器被移除：没有圆点，也没有 实时/连接中 文字。连接与加载状态改为在真正要紧的地方呈现。首次读取进行中时出现加载提示行，宿主不可达时出现附带重试建议的错误文案。

这取代了 [ADR 10](10-treat-the-panel-as-an-app-shell-with-logo-rail-topbar-and-scrolling-content.md) 中关于 "live state" 的部分。该外壳的其余部分仍然成立。

## Alternatives considered

**保留圆点、去掉文字。** 已否决：圆点仍与行内状态点重复，而且一个空闲的绿色圆点挨着正在工作的看板，只会成为看起来像装饰的噪音。

**只在悬停时显示标签。** title 属性已经说明了开关的作用，一个悬停才浮现的可见标签，会给唯一应当保持镇定的元素增添动效。

**用图标同时替代两者。** 已否决：56px 高的条带里又要多出一个符号，而滑块本身已经是开/关最清晰的表达。

## Consequences

- 面板不再有一眼可辨的 "connected" 指示。轮询失败通过错误文案体现，而不是靠一个悄悄变红的圆点。
- 开关的状态由滑块位置、滑轨颜色、aria-checked 和 data-coordination 共同承载；UI 测试继续断言恰好只有一个 role=switch，并且它能切换、能切回。
- 顶栏右侧现在只是一个 38x30 的点击目标，相比"标签加滑块"也更容易命中。
- 项目栏没有任何变化：行内圆点依然是状态的用词体系（ADR 4、ADR 11）。
