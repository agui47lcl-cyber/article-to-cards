import { DOMParser, Element, HTMLElement, Node } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { convertPastedContentToMarkdown, richTextHtmlToMarkdown } from './rich-text-to-markdown'

Object.assign(globalThis, { DOMParser, Element, HTMLElement, Node })

describe(`richTextHtmlToMarkdown`, () => {
  it(`preserves headings, inline emphasis, links, lists and quotes`, () => {
    const markdown = richTextHtmlToMarkdown(`
      <h1>重新设计工作流</h1>
      <p>这是一段包含<strong>重点</strong>和<a href="https://example.com/docs">参考资料</a>的正文。</p>
      <ul>
        <li>收集资料</li>
        <li>梳理目标<ol><li>确认范围</li></ol></li>
      </ul>
      <blockquote><p>工具越简单，思考越应该清晰。</p></blockquote>
    `)

    expect(markdown).toBe(`# 重新设计工作流

这是一段包含**重点**和[参考资料](https://example.com/docs)的正文。

- 收集资料
- 梳理目标
  1. 确认范围

> 工具越简单，思考越应该清晰。`)
  })

  it(`converts rich-text tables to Markdown tables`, () => {
    const markdown = richTextHtmlToMarkdown(`
      <table>
        <thead><tr><th>事项</th><th>状态</th></tr></thead>
        <tbody><tr><td>设计</td><td>完成</td></tr></tbody>
      </table>
    `)

    expect(markdown).toBe(`| 事项 | 状态 |
| --- | --- |
| 设计 | 完成 |`)
  })

  it(`recognizes a large styled paragraph as a heading`, () => {
    expect(richTextHtmlToMarkdown(`<p><span style="font-size: 24px; font-weight: 700">章节标题</span></p><p>正文内容。</p>`))
      .toBe(`## **章节标题**

正文内容。`)
  })
})

describe(`convertPastedContentToMarkdown`, () => {
  it(`prefers clipboard HTML when it contains formatting`, () => {
    expect(convertPastedContentToMarkdown({
      html: `<p>普通文字与<strong>加粗文字</strong></p>`,
      text: `普通文字与加粗文字`,
    })).toEqual({
      markdown: `# 普通文字与**加粗文字**`,
      source: `html`,
    })
  })

  it(`classifies a rich long-form article after preserving inline styles`, () => {
    const result = convertPastedContentToMarkdown({
      html: `
        <p><strong>一个好的工作流，首先要解决混乱</strong></p>
        <p>工作效率低，并不一定是因为能力不足。更多时候，是因为任务、资料、工具和决策分散在不同位置。</p>
        <p><strong>一、先建立统一的信息入口</strong></p>
        <p>把需求、参考资料和会议结论放在同一个位置，才能减少重复查找和反复确认。</p>
        <p><em>工具越简单，思考越应该清晰。</em></p>
      `,
      text: `一个好的工作流，首先要解决混乱\n\n工作效率低，并不一定是因为能力不足。更多时候，是因为任务、资料、工具和决策分散在不同位置。\n\n一、先建立统一的信息入口\n\n把需求、参考资料和会议结论放在同一个位置，才能减少重复查找和反复确认。\n\n工具越简单，思考越应该清晰。`,
    })

    expect(result?.markdown).toBe(`# **一个好的工作流，首先要解决混乱**

工作效率低，并不一定是因为能力不足。更多时候，是因为任务、资料、工具和决策分散在不同位置。

## **一、先建立统一的信息入口**

把需求、参考资料和会议结论放在同一个位置，才能减少重复查找和反复确认。

> 工具越简单，思考越应该清晰。`)
  })

  it(`recognizes quote-like rich-text containers`, () => {
    expect(richTextHtmlToMarkdown(`<div class="quote-card"><p>真正高效的系统，会减少重复确认。</p></div>`))
      .toBe(`> 真正高效的系统，会减少重复确认。`)
  })

  it(`falls back to plain-text structure recognition`, () => {
    expect(convertPastedContentToMarkdown({
      html: `<div>执行清单<br>1、确认目标<br>2、开始创作</div>`,
      text: `执行清单\n\n1、确认目标\n2、开始创作`,
    })).toEqual({
      markdown: `# 执行清单\n\n1. 确认目标\n2. 开始创作`,
      source: `plain-text`,
    })
  })
})
