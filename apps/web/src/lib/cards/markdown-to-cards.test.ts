/**
 * [INPUT]: 依赖卡片封面拆分与文学智能摘录的纯函数
 * [OUTPUT]: 验证标题提取、正文保留、文学摘录筛选、短句编排、日期题记和封面组合行为
 * [POS]: cards 领域的封面策略回归测试，保护特殊模板分页前的数据边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, it } from 'vitest'
import {
  extractLiteraryExcerpt,
  formatLiteraryCoverDate,
  splitCardCoverSource,
  splitLiteraryCardCoverSource,
  splitLiteraryExcerptLines,
} from './card-cover'

describe(`splitCardCoverSource`, () => {
  it(`extracts the first level-one heading as a standalone cover`, () => {
    expect(splitCardCoverSource(`# 主标题\n\n正文第一段\n\n## 小标题`, `备用标题`)).toEqual({
      coverMarkdown: `# 主标题`,
      bodyMarkdown: `正文第一段\n\n## 小标题`,
    })
  })

  it(`keeps body content when the heading is followed without a blank line`, () => {
    expect(splitCardCoverSource(`# 主标题\n正文第一段`, `备用标题`)).toEqual({
      coverMarkdown: `# 主标题`,
      bodyMarkdown: `正文第一段`,
    })
  })

  it(`uses the post title when no level-one heading exists`, () => {
    expect(splitCardCoverSource(`## 小标题\n\n正文`, `文章标题`)).toEqual({
      coverMarkdown: `# 文章标题`,
      bodyMarkdown: `## 小标题\n\n正文`,
    })
  })

  it(`selects a readable literary excerpt instead of headings and code`, () => {
    const excerpt = extractLiteraryExcerpt(`## 开场

简短说明。

\`\`\`ts
const hidden = true
\`\`\`

风停了，雨也停了，阁楼上的旧唱片仍在缓慢旋转。月光越过窗棂，落在泛黄的信纸上，那些没有寄出的句子，终于在深夜里有了回声。我们曾以为告别只是转身，后来才明白，每一片落叶都替时间保存着未说完的话。`)

    expect(excerpt).toContain(`风停了，雨也停了`)
    expect(excerpt).not.toContain(`const hidden`)
    expect(excerpt.length).toBeLessThanOrEqual(170)
  })

  it(`builds a literary cover without removing excerpt text from the body`, () => {
    const source = `# 浮生的灯火阑珊

风停了，雨也停了，阁楼上的旧唱片仍在缓慢旋转。月光越过窗棂，落在泛黄的信纸上，那些没有寄出的句子，终于在深夜里有了回声。

## 时间的慈悲

正文继续向前。`
    const result = splitLiteraryCardCoverSource(source, `备用标题`)

    expect(result.coverMarkdown).toContain(`# 浮生的灯火阑珊`)
    expect(result.coverMarkdown).toContain(`风停了 雨也停了`)
    expect(result.bodyMarkdown).toContain(`风停了，雨也停了`)
    expect(result.bodyMarkdown).toContain(`## 时间的慈悲`)
  })

  it(`arranges a literary excerpt as compact short lines`, () => {
    const lines = splitLiteraryExcerptLines(`天地大，爱恨能落墨几斗。千万里山河不为我迁就，世间纸短情难相留。这份离愁道不尽，红尘巍巍高几楼，心无愁，等闲一场梦难留。`)

    expect(lines.length).toBeLessThanOrEqual(8)
    expect(lines.every(line => Array.from(line.replace(/\s/g, ``)).length <= 10)).toBe(true)
    expect(lines[0]).toBe(`天地大 爱恨能落墨几斗`)
  })

  it(`uses Markdown hard breaks for literary cover excerpt lines`, () => {
    const result = splitLiteraryCardCoverSource(`# 标题\n\n风停了，雨也停了，阁楼上的旧唱片仍在缓慢旋转。月光越过窗棂，落在泛黄的信纸上，那些没有寄出的句子终于有了回声。`, `备用标题`)

    expect(result.coverMarkdown).toContain(`风停了 雨也停了  \n`)
  })

  it(`formats the literary cover date as a Chinese cyclical inscription`, () => {
    expect(formatLiteraryCoverDate(new Date(2026, 6, 26, 11))).toBe(`丙午年七月 午时`)
    expect(formatLiteraryCoverDate(new Date(2025, 0, 1, 23))).toBe(`乙巳年一月 子时`)
  })
})
