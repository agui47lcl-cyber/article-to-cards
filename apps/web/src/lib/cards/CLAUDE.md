# cards/
> L2 | 父级: `/CLAUDE.md`

长图文内容领域：在不依赖视图组件的前提下完成纯文本/富文本转 Markdown、模板 token 注册、封面策略、分页数据建模与安全 HTML 渲染；组件只消费这些稳定接口并负责 DOM 实测。

## 成员清单

`card-cover.ts`: 封面内容策略，提取一级标题、保留完整正文，并为文学模板生成确定性的精彩片段摘录、右下角短句编排与干支日期题记。
`card-templates.ts`: 模板与比例注册表，将 900px 设计尺寸映射为 420px 预览 token 和 CSS 变量。
`markdown-to-cards.ts`: Markdown 卡片模型与基础分页器，负责分隔符、估重、HTML 渲染和页面元数据。
`markdown-to-cards.test.ts`: 封面策略回归测试，覆盖通用标题拆分、文学摘录组合、短句行宽约束和日期题记格式。
`plain-text-to-markdown.ts`: 无格式长文的结构识别器，将标题、正文、列表和引用转换为 Markdown。
`plain-text-to-markdown.test.ts`: 纯文本结构识别回归测试。
`rich-text-to-markdown.ts`: 粘贴富文本到 Markdown 的转换与清理逻辑。
`rich-text-to-markdown.test.ts`: 富文本转换回归测试。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
