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
})
