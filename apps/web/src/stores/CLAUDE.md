# stores/
> L2 | 父级: `/CLAUDE.md`

Web 应用状态层：以 Pinia 和持久化 storage 管理跨组件业务状态，视图通过明确的 store 边界共享编辑器、文章、主题、同步、账户与长图文配置，避免组件间直接耦合。

## 成员清单

`aiConfig.ts`: AI 文本服务配置与持久化状态。
`aiImageConfig.ts`: AI 图片服务配置与持久化状态。
`auth.ts`: 用户身份、登录态与账户信息。
`confirm.ts`: 全局确认对话框状态与异步结果协调。
`cssEditor.ts`: 自定义 CSS 方案、选择与编辑状态。
`customComponent.ts`: 自定义公众号组件的定义与持久化管理。
`editor.ts`: CodeMirror 实例、内容操作和光标级命令状态。
`export.ts`: 导出流程的配置与阶段状态。
`folderSource.ts`: 本地文件夹数据源、权限和文件选择状态。
`locale.ts`: 当前语言与本地化切换状态。
`mpAccounts.ts`: 公众号账户配置与选择状态。
`post.ts`: 文章树、当前文章、内容与历史状态。
`quickCommands.ts`: 快捷命令集合与执行入口状态。
`render.ts`: Markdown 渲染结果和刷新协调状态。
`sync.ts`: 云同步配置、进度与冲突状态。
`template.ts`: 内容模板的增删改查和选择状态。
`theme.ts`: 公众号/长图文共享的主题、字体、字号、颜色和代码样式状态。
`ui.ts`: 全局界面与预览状态，包含长图文模式、模板和比例选择。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
