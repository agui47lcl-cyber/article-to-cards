# editor/
> L2 | 父级: `/CLAUDE.md`

编辑器工作区的组合层：负责组织 Markdown 输入、公众号/长图文预览、样式配置、状态栏与上下文操作；业务状态向 Pinia store 收敛，渲染与转换能力依赖 `lib/` 和 `services/`，本目录只协调交互与视图。

## 成员清单

`CardPreviewPanel.vue`: 长图文预览核心，协调字体就绪后的真实 DOM 测量分页、通用/文学封面策略、模板视觉、溢出检测和 PNG/ZIP 导出。
`CodemirrorEditor.vue`: 编辑器工作区壳层，组合输入、预览、侧栏、弹窗及桌面分栏布局。
`CssEditor.vue`: 自定义主题样式管理界面，负责样式片段编辑、选择、预览和导出。
`EditorContextMenu.vue`: 编辑区上下文命令入口，复用文档操作与格式化能力处理插入、导入、转换和清理动作。
`EditorPanel.vue`: CodeMirror 适配层，管理编辑器生命周期、粘贴转换、图片上传和内容同步。
`Footer.vue`: 编辑器状态栏，展示文档统计、导航、视图控制、同步和账户状态。
`FormItem.vue`: 编辑器表单布局原语，统一标签、必填标识、提示和错误信息结构。
`PreviewPanel.vue`: 预览模式路由层，在公众号渲染与长图文卡片预览之间切换并完成图表水合。
`RightSlider.vue`: 样式配置面板，将主题、字体、字号、颜色和长图文模板选项写入状态层。
`SlashCommandMenu.vue`: 斜杠命令浮层，呈现可检索的编辑、格式、插入和文档级命令。
`dialogs/`: 编辑器弹窗子域，承载导入、上传、公式、模板与账户等阶段性交互。
`editor-header/`: 顶部命令区子域，承载文件、编辑、发布、模式切换和账户入口。
`folder-source-panel/`: 文件夹数据源面板子域，负责外部 Markdown 目录浏览与选择。
`post-slider/`: 文章树侧栏子域，负责文档层级、选择、拖拽和历史操作。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
