# 架构决策记录

本目录是仓库的记忆，用来对抗 agent 的两种失效模式：埋头执行任务时偏离长期决策，以及忘记已经定下的选择，直到它们以不一致的形式重新浮现。

记录遵循 proposed/、implemented/、rejected/ 和 archived/ 四个生命周期文件夹。这些文件夹既是生命周期，也是上下文预算：implemented/ 是当前的权威，需完整阅读；proposed/ 是意向，需检查；rejected/ 是反模式记忆，需检查；archived/ 是价值最低的冻结历史，默认不读。这四个文件夹就是记录的全部清单：adr/ 之下或这些文件夹之内不得另设其他文件夹；放在 adr/ 根部的 Markdown 记录会让校验失败，而不是从 list 命令的输出里悄然消失。

提案即便方向已定也仍属未落地。implemented 记录描述已经落地的决策，并获得稳定的 ADR 编号。否决记录是对被拒绝提案的永久性终结记录：只有当另一条记录接管了它所防范的警告时才可移除，绝不因「看起来过时」而移除。否决记录不编号，因此删掉一条冗余的否决记录不会让某个编号被复用。archived 记录是冻结的历史，不是当前权威。它们是普通的、由 Git 跟踪的记录：adrkit validate 会像校验清单里其余记录一样校验它们，任何后续改动都能在 Git 历史中看到。

永远不要删除带编号的决策：它稳定的编号 N 可能在别处被引用。implemented 记录可以刷新事实性的路径、符号和默认值，但决策一旦改变就需要新记录。归档或取代，而不是抹除。

如果一条带编号的记录是误建的、且还没有任何东西引用它，那么移除它是一次 Git 操作，不是生命周期迁移：用 git rm 移除它，并且同一个 commit 还要移除或更新所有引用该编号的地方，同时在 commit 信息里说明原因。pre-commit 钩子会对这类移除发出提醒；把这当作再次确认没有任何引用存在的时机。这条记录会留存在 Git 历史中——所有 archived 记录都是如此。

头部字段的规范格式包含 status、date 和 created: YYYY-MM-DD（created 是诞生日期，绝不重新盖章）。带编号的记录要声明 raised-by: human | agent 与 decided-by: human | agent；它们是出处声明，不是批准凭证。description 为必填，说明何时该读这条记录；可选的 paths: [src/payments/**] 把记录的作用范围限定到它管辖的文件上。

未落地的工作用 adrkit propose，落地之后用 adrkit implement，已经落地的决策用 adrkit record 补记。确定不会落地的提案用 adrkit reject 并给出理由。完整替换会通过 adrkit supersede 把旧的 implemented 记录归档；adrkit archive 还可以退役那些理由已不再需要在活跃集合中保留的 implemented 指导。

用 adrkit list 发现记录。完整阅读相关的 implemented/ 记录；检查相关的 proposed/ 记录以了解意向，检查 rejected/ 记录以了解它们所警告的反例；只有当任务引用历史时才查阅 archived/。不要只凭标题判断相关性；当任务针对具体文件时，用 adrkit relevant <path> 检索作用于这些文件的记录。针对实际改动，用 adrkit relevant --base <review-base> 或 --staged。对于未标注范围的决策，要在范围匹配之外辅以通读清单来补充，并处理搜索不完整的诊断提示；没有匹配不等于没有约束。用 adrkit validate 检查仓库。
