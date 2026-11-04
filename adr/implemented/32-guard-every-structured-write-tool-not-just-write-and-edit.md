---
status: implemented
date: 2026-11-04
description: 唯一的写守卫策略覆盖每一个以结构化参数指名文件的写工具（write、edit、multi_edit、create_file、apply_patch），而不只是 write/edit；解析不出目标的补丁放行而非猜测性拒绝。
raised-by: agent
decided-by: human
created: 2026-11-04
---

# ADR: 32 守卫每一个结构化写工具，而不只是 write 和 edit

## Problem

守卫是租约制度的执法点，但它只拦截两个工具名：`write` 和 `edit`。同一份宿主代码的活动跟踪器却认识 `multi_edit`、`apply_patch`、`create_file`——说明宿主确实提供这些改文件的工具。于是一次经核实的绕过：Alice 持有 `src/hot.ts` 的活租约，Bob 用 `multi_edit`、`create_file` 或 `apply_patch` 改同一个文件，守卫一律放行，既不拒绝也不建立租约。产品的第二条职责（两个 agent 不同时编辑同一路径）在这几个工具名下形同虚设。经复现坐实：三个工具在活冲突租约下全部 allow。

Pi 侧存在同类的 narrower 漏洞：守卫只读 `input.path` 一种参数拼写，而 DSH 侧早就因为同样的原因统一走多拼写解析（`file_path`/`path`/`paths[0]`），其注释明言「跟踪器认识而守卫不认识的拼写会静默绕过租约检查」。

## Decision

守卫策略仍然只有一条（ADR 22 不变），但它的覆盖面定义为：**每一个以结构化参数指名目标文件的写工具**。

1. DSH 宿主守卫 `write`、`edit`、`multi_edit`、`create_file`、`apply_patch`。前四个的目标经统一的多拼写解析取得；`apply_patch` 没有路径参数，目标从补丁文本的 `*** Add/Update/Delete File:` 行解析，一次补丁可以触及多个文件，全部目标先做冲突检查、再一次性自动建立租约。
2. 解析不出目标的输入放行（fail open）：一个不认识的补丁格式产生零个目标，守卫照常放行，绝不基于猜测拒绝写入。这与「守卫自身故障不阻断工作」的既有失败开放原则同构。
3. Pi 守卫读取与 DSH 相同的参数拼写集合（`file_path`/`path`/`paths[0]`），工具名保持 Pi 实际提供的 `write`/`edit`。
4. 新增宿主写工具时，只要它以结构化参数指名文件，就加入被守卫集合；守卫集合的权威清单是宿主代码里的 `GUARDED_WRITE_TOOLS` 常量，本记录不复述工具清单以外的易变事实。

Shell 工具（`bash`、`run_code`）维持既有边界：不在守卫范围内，这在 ADR 22 与本记录中都不变。

## Alternatives considered

- 维持只守卫 write/edit，把其余工具记为已知限制。否决：被绕过的恰是产品核心保证，且宿主确实提供这些工具；「文档承认漏洞」不满足第二条产品职责。
- 在存储层做全局路径锁而不是在工具入口守卫。否决：违反「不加全局锁」的仓库不变量，也重写了 ADR 22 已定的一条策略。
- 对解析不出目标的 apply_patch 一律拒绝（fail closed）。否决：与守卫既有的失败开放原则冲突——协调层的自身局限不应阻断真实工作；拒绝一个无法理解的补丁只会训练用户绕过守卫。
- 把多拼写解析放进 godview 核心供两个宿主共享。否决：参数拼写是宿主工具协议的属性，不是板文件格式的属性；核心包保持对宿主无知（ADR 25/29 的包边界），两侧各自持有一个小解析函数。

## Consequences

- 守卫的洞被堵上：同一文件的 multi_edit/create_file/apply_patch 现在与 write/edit 走同一条拒绝/自动租约路径，host smoke 对三个工具名各有一条 deny 断言，外加一条「补丁全部目标被自动租约」和一条「不可解析补丁放行」断言；Pi 侧新增 file_path 拼写的守卫测试。
- 代价是守卫对 apply_patch 补丁格式有了一个解析依赖：格式演进时解析器要跟着走，否则退化回今天的放行行为——退化是安全的（fail open），但会重新打开洞，所以补丁格式变化时必须更新解析与测试。
- 一次多文件补丁会原子地对该补丁的全部目标建立租约；任何一个目标冲突即整体拒绝，不会出现半个补丁被租约覆盖的状态。
