import { describe, expect, it } from 'vitest'
import { splitCardCoverSource } from './card-cover'

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
})
