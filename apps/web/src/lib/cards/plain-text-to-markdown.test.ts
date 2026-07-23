import { describe, expect, it } from 'vitest'
import { structurePlainTextForCards } from './plain-text-to-markdown'

describe(`structurePlainTextForCards`, () => {
  it(`recognizes a title, body, list and quote`, () => {
    const result = structurePlainTextForCards(`重新设计我们的工作方式

AI 正在改变内容创作，但真正重要的是建立稳定的工作流。

主要步骤

• 收集背景资料
• 梳理核心目标
• 完成最终交付

“工具越简单，思考越应该清晰。”`)

    expect(result?.markdown).toBe(`# 重新设计我们的工作方式

AI 正在改变内容创作，但真正重要的是建立稳定的工作流。

## 主要步骤

- 收集背景资料
- 梳理核心目标
- 完成最终交付

> 工具越简单，思考越应该清晰。`)
    expect(result?.detected).toEqual({ headings: 2, lists: 3, quotes: 1 })
  })

  it(`normalizes numbered plain-text lists`, () => {
    const result = structurePlainTextForCards(`执行清单

1、确认目标
2、准备资料
3、开始创作`)

    expect(result?.markdown).toContain(`1. 确认目标\n2. 准备资料\n3. 开始创作`)
  })

  it(`does not rewrite existing Markdown`, () => {
    expect(structurePlainTextForCards(`# 已有标题\n\n- 已有列表`)).toBeNull()
    expect(structurePlainTextForCards(`> 已有引用`)).toBeNull()
  })

  it(`does not force structure onto an ordinary paragraph`, () => {
    expect(structurePlainTextForCards(`这是一段已经完整表达意思的普通正文。`)).toBeNull()
  })

  it(`classifies unmarked sections around existing Markdown blocks`, () => {
    const result = structurePlainTextForCards(`# 已有大标题

这是一段用于介绍背景的正文内容，长度足够说明它不是标题。

**核心方法**

这里是核心方法对应的详细说明，包含完整的上下文和执行建议。

- 已有列表项`)

    expect(result?.markdown).toContain(`## **核心方法**`)
    expect(result?.markdown).toContain(`- 已有列表项`)
  })

  it(`keeps fenced code untouched while recognizing surrounding sections`, () => {
    const result = structurePlainTextForCards(`工作流说明

正文部分用于介绍下面的代码示例。

\`\`\`text
这不是标题
• 这也不是列表
\`\`\`

总结

这里是最后一段足够长的总结说明文字。`)

    expect(result?.markdown).toContain(`\`\`\`text\n这不是标题\n• 这也不是列表\n\`\`\``)
    expect(result?.markdown).toContain(`## 总结`)
  })
})
