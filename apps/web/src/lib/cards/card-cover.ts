/**
 * [INPUT]: 依赖 Markdown 一级标题、正文块和行内标记约定
 * [OUTPUT]: 对外提供通用封面拆分、文学模板智能摘录、短句编排、封面构建与日期题记格式化能力
 * [POS]: cards 内容预处理层的封面策略，保持正文完整并为不同模板生成独立封面内容
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const COVER_HEADING_RE = /^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/m
const LITERARY_EXCERPT_MIN_LENGTH = 48
const LITERARY_EXCERPT_TARGET_LENGTH = 120
const LITERARY_EXCERPT_MAX_LENGTH = 170
const LITERARY_EXCERPT_LINE_MAX_LENGTH = 10
const LITERARY_EXCERPT_MAX_LINES = 8
const HEAVENLY_STEMS = [`甲`, `乙`, `丙`, `丁`, `戊`, `己`, `庚`, `辛`, `壬`, `癸`]
const EARTHLY_BRANCHES = [`子`, `丑`, `寅`, `卯`, `辰`, `巳`, `午`, `未`, `申`, `酉`, `戌`, `亥`]
const CHINESE_MONTHS = [`一`, `二`, `三`, `四`, `五`, `六`, `七`, `八`, `九`, `十`, `十一`, `十二`]

function stripLiteraryMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ``)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, `$1`)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, `$1`)
    .replace(/^\s{0,3}#{1,6}\s+/gm, ``)
    .replace(/^\s*>\s?/gm, ``)
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, ``)
    .replace(/^\s*---card---\s*$/gim, ``)
    .replace(/<[^>]+>/g, ``)
    .replace(/[`*_~]/g, ``)
    .replace(/\s+/g, ` `)
    .trim()
}

function splitLiterarySentences(value: string) {
  return value
    .match(/[^。！？!?；;]+[。！？!?；;]?/g)
    ?.map(sentence => sentence.trim())
    .filter(Boolean) ?? []
}

function createLiteraryWindows(value: string) {
  const sentences = splitLiterarySentences(value)
  if (sentences.length <= 1)
    return value ? [value] : []

  const windows: string[] = []
  for (let start = 0; start < sentences.length; start += 1) {
    let current = ``
    for (let index = start; index < sentences.length; index += 1) {
      const next = `${current}${sentences[index]}`
      if (next.length > LITERARY_EXCERPT_MAX_LENGTH && current)
        break
      current = next
      if (current.length >= LITERARY_EXCERPT_MIN_LENGTH)
        windows.push(current)
      if (current.length >= LITERARY_EXCERPT_MAX_LENGTH)
        break
    }
  }

  return windows.length ? windows : [value]
}

function scoreLiteraryExcerpt(value: string, order: number) {
  const lengthScore = 100 - Math.abs(value.length - LITERARY_EXCERPT_TARGET_LENGTH)
  const punctuationScore = (value.match(/[，。！？；：“”‘’、—…]/g) || []).length * 2
  const imageScore = (value.match(/[风雨云月花叶灯火山海夜梦心]/g) || []).length * 1.5
  return lengthScore + punctuationScore + imageScore - order * 0.35
}

function clampLiteraryExcerpt(value: string) {
  if (value.length <= LITERARY_EXCERPT_MAX_LENGTH)
    return value

  const slice = value.slice(0, LITERARY_EXCERPT_MAX_LENGTH)
  const boundary = Math.max(
    slice.lastIndexOf(`。`),
    slice.lastIndexOf(`！`),
    slice.lastIndexOf(`？`),
    slice.lastIndexOf(`；`),
  )

  if (boundary >= LITERARY_EXCERPT_MIN_LENGTH)
    return slice.slice(0, boundary + 1)
  return `${slice.trimEnd()}…`
}

export function extractLiteraryExcerpt(markdown: string) {
  const paragraphs = markdown
    .replace(/```[\s\S]*?```/g, ``)
    .split(/\n{2,}/)
    .filter(block => !/^\s{0,3}#{1,6}\s+/.test(block))
    .map(stripLiteraryMarkdown)
    .filter(Boolean)

  const candidates = paragraphs.flatMap(createLiteraryWindows)
  if (!candidates.length)
    return ``

  const best = candidates.reduce((selected, candidate, index) => {
    const score = scoreLiteraryExcerpt(candidate, index)
    return score > selected.score ? { value: candidate, score } : selected
  }, { value: candidates[0], score: Number.NEGATIVE_INFINITY })

  return clampLiteraryExcerpt(best.value)
}

function splitLongLiteraryPhrase(value: string) {
  const characters = Array.from(value)
  const lineCount = Math.ceil(characters.length / LITERARY_EXCERPT_LINE_MAX_LENGTH)
  if (lineCount <= 1)
    return [value]

  const phrases: string[] = []
  let offset = 0
  for (let index = 0; index < lineCount; index += 1) {
    const remainingCharacters = characters.length - offset
    const remainingLines = lineCount - index
    const currentLength = Math.ceil(remainingCharacters / remainingLines)
    phrases.push(characters.slice(offset, offset + currentLength).join(``))
    offset += currentLength
  }
  return phrases
}

function literaryLineLength(value: string) {
  return Array.from(value.replace(/\s/g, ``)).length
}

export function splitLiteraryExcerptLines(value: string) {
  const phrases = value
    .replace(/[“”‘’「」『』]/g, ``)
    .split(/[，,。！？!?；;：:\n]+|\s+/)
    .map(phrase => phrase.trim())
    .filter(Boolean)
    .flatMap(splitLongLiteraryPhrase)

  const lines: string[] = []
  let current = ``

  for (const phrase of phrases) {
    const combined = current ? `${current} ${phrase}` : phrase
    if (current && literaryLineLength(combined) > LITERARY_EXCERPT_LINE_MAX_LENGTH) {
      lines.push(current)
      current = phrase
    }
    else {
      current = combined
    }

    if (lines.length >= LITERARY_EXCERPT_MAX_LINES) {
      current = ``
      break
    }
  }

  if (current && lines.length < LITERARY_EXCERPT_MAX_LINES)
    lines.push(current)

  return lines
}

export function formatLiteraryCoverDate(date: Date) {
  const year = date.getFullYear()
  const stem = HEAVENLY_STEMS[((year - 4) % HEAVENLY_STEMS.length + HEAVENLY_STEMS.length) % HEAVENLY_STEMS.length]
  const branch = EARTHLY_BRANCHES[((year - 4) % EARTHLY_BRANCHES.length + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length]
  const month = CHINESE_MONTHS[date.getMonth()]
  const hourBranch = EARTHLY_BRANCHES[Math.floor(((date.getHours() + 1) % 24) / 2)]

  return `${stem}${branch}年${month}月 ${hourBranch}时`
}

export function splitCardCoverSource(markdown: string, fallbackTitle: string) {
  const source = markdown.trim()
  const match = COVER_HEADING_RE.exec(source)

  if (match) {
    const start = match.index
    const end = start + match[0].length
    return {
      coverMarkdown: `# ${match[1].trim()}`,
      bodyMarkdown: `${source.slice(0, start)}${source.slice(end)}`.trim(),
    }
  }

  const title = fallbackTitle.replace(/\s+/g, ` `).trim() || `长图文卡片`
  return {
    coverMarkdown: `# ${title}`,
    bodyMarkdown: source,
  }
}

export function splitLiteraryCardCoverSource(markdown: string, fallbackTitle: string) {
  const cover = splitCardCoverSource(markdown, fallbackTitle)
  const excerpt = extractLiteraryExcerpt(cover.bodyMarkdown)
  const excerptLines = splitLiteraryExcerptLines(excerpt)
  const formattedExcerpt = excerptLines.join(`  \n`)

  return {
    coverMarkdown: formattedExcerpt ? `${cover.coverMarkdown}\n\n${formattedExcerpt}` : cover.coverMarkdown,
    bodyMarkdown: cover.bodyMarkdown,
  }
}
