export interface StructuredPasteResult {
  markdown: string
  detected: {
    headings: number
    lists: number
    quotes: number
  }
}

const existingBlockStructureRe = /^(?:#{1,6}\s+|>\s?|`{3,}|~{3,}|\s*[-*+]\s+|\s*\d+[.)]\s+)/
const fenceRe = /^\s*(`{3,}|~{3,})/
const sentenceEndRe = /[。！？；：.!?;:]$/
const bulletRe = /^\s*[•●▪◦·]\s*(.+)$/
const numberedRe = /^\s*(\d{1,2})[、.)．]\s*(.+)$/
const chineseNumberedRe = /^\s*([一二三四五六七八九十]+)[、.．]\s*(.+)$/
const explicitHeadingRe = /^(?:第[一二三四五六七八九十百\d]+[章节篇部分]|[一二三四五六七八九十]+[、.．]|\d{1,2}[、．|｜]\s*\S)/
const headingKeywordRe = /^(?:前言|引言|序言|摘要|背景|正文|结语|总结|小结|结论|建议|方法|步骤|注意事项|核心观点|重点)(?:[：:]|$)/

function stripMarkdownInline(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, `$1`)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, `$1`)
    .replace(/(?:\*\*|__|~~|`+)(.*?)(?:\*\*|__|~~|`+)/g, `$1`)
    .replace(/^[*_]+|[*_]+$/g, ``)
    .trim()
}

function visibleLength(value: string) {
  return Array.from(value.trim()).length
}

function isShortHeadingCandidate(value: string, maxLength = 36) {
  const text = stripMarkdownInline(value)
  const length = visibleLength(text)
  return length >= 2
    && length <= maxLength
    && !sentenceEndRe.test(text)
    && !bulletRe.test(text)
}

function unwrapQuote(value: string) {
  const text = stripMarkdownInline(value)
  const pairs: Array<[string, string]> = [
    [`“`, `”`],
    [`「`, `」`],
    [`『`, `』`],
  ]

  for (const [start, end] of pairs) {
    if (text.startsWith(start) && text.endsWith(end) && visibleLength(text) > 2)
      return text.slice(start.length, -end.length).trim()
  }

  const labelled = text.match(/^(?:引用|摘录|金句|引文|Quote)[：:]\s*(.+)$/i)
  return labelled?.[1]?.trim() || null
}

function unwrapStandaloneItalic(value: string) {
  const text = value.trim()
  const match = text.match(/^(?:\*([^*].*?)\*|_([^_].*?)_)$/)
  const quote = match?.[1] || match?.[2]
  return quote && visibleLength(quote) >= 8 ? quote.trim() : null
}

function nextNonEmptyLine(lines: string[], from: number) {
  for (let index = from + 1; index < lines.length; index += 1) {
    if (lines[index].trim())
      return lines[index].trim()
  }
  return ``
}

/**
 * Conservatively add Markdown structure to pasted long-form text for card mode.
 * Existing block syntax and fenced code are preserved while unmarked sections
 * can still be classified.
 */
export function structurePlainTextForCards(input: string): StructuredPasteResult | null {
  const normalized = input
    .replace(/\r\n?/g, `\n`)
    .replace(/[ \t]+$/gm, ``)
    .trim()

  if (!normalized)
    return null

  const lines = normalized.split(`\n`)
  const nonEmptyIndexes = lines
    .map((line, index) => line.trim() ? index : -1)
    .filter(index => index >= 0)
  if (nonEmptyIndexes.length === 0)
    return null

  const firstContentIndex = nonEmptyIndexes[0]
  const output: string[] = []
  const detected = { headings: 0, lists: 0, quotes: 0 }
  let fenceMarker = ``

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim()
    if (!text) {
      if (output.at(-1) !== ``)
        output.push(``)
      continue
    }

    const fence = text.match(fenceRe)?.[1]
    if (fence) {
      output.push(text)
      if (!fenceMarker)
        fenceMarker = fence[0]
      else if (fence[0] === fenceMarker)
        fenceMarker = ``
      continue
    }
    if (fenceMarker) {
      output.push(lines[index])
      continue
    }

    if (existingBlockStructureRe.test(text)) {
      output.push(text)
      continue
    }

    const surroundedBySpace = (index === 0 || !lines[index - 1].trim())
      && (index === lines.length - 1 || !lines[index + 1].trim())
    const nextLine = nextNonEmptyLine(lines, index)
    const visibleText = stripMarkdownInline(text)
    const visibleNextLine = stripMarkdownInline(nextLine)
    const introducesLongerBlock = visibleLength(visibleNextLine) >= Math.max(20, visibleLength(visibleText) * 1.6)
    const introducesStructuredBlock = bulletRe.test(nextLine)
      || numberedRe.test(nextLine)
      || chineseNumberedRe.test(nextLine)
      || unwrapQuote(nextLine) !== null

    const quote = unwrapQuote(text)
    if (quote) {
      output.push(`> ${quote}`)
      detected.quotes += 1
      continue
    }

    const italicQuote = surroundedBySpace ? unwrapStandaloneItalic(text) : null
    if (italicQuote) {
      output.push(`> ${italicQuote}`)
      detected.quotes += 1
      continue
    }

    const bullet = text.match(bulletRe)
    if (bullet) {
      output.push(`- ${bullet[1].trim()}`)
      detected.lists += 1
      continue
    }

    const numbered = text.match(numberedRe)
    if (numbered) {
      if (surroundedBySpace && introducesLongerBlock) {
        output.push(`## ${text}`)
        detected.headings += 1
        continue
      }
      output.push(`${numbered[1]}. ${numbered[2].trim()}`)
      detected.lists += 1
      continue
    }

    const chineseNumbered = text.match(chineseNumberedRe)
    if (chineseNumbered) {
      if (surroundedBySpace && introducesLongerBlock) {
        output.push(`## ${text}`)
        detected.headings += 1
        continue
      }
      output.push(`- ${chineseNumbered[2].trim()}`)
      detected.lists += 1
      continue
    }

    if (index === firstContentIndex && isShortHeadingCandidate(text, 48)) {
      output.push(`# ${text}`)
      detected.headings += 1
      continue
    }

    if (
      isShortHeadingCandidate(text)
      && (
        explicitHeadingRe.test(visibleText)
        || headingKeywordRe.test(visibleText)
        || (surroundedBySpace && (introducesLongerBlock || introducesStructuredBlock))
      )
    ) {
      output.push(`## ${text}`)
      detected.headings += 1
      continue
    }

    output.push(text)
  }

  const markdown = output.join(`\n`).replace(/\n{3,}/g, `\n\n`).trim()
  const totalDetected = detected.headings + detected.lists + detected.quotes
  if (totalDetected === 0 || markdown === normalized)
    return null

  return { markdown, detected }
}
