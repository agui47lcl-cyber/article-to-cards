export interface StructuredPasteResult {
  markdown: string
  detected: {
    headings: number
    lists: number
    quotes: number
  }
}

const markdownStructureRe = /^(?:#{1,6}\s+|>\s+|```|~~~|\s*[-*+]\s+|\s*\d+[.)]\s+)/m
const sentenceEndRe = /[。！？；：.!?;:]$/
const bulletRe = /^\s*[•●▪◦·]\s*(.+)$/
const numberedRe = /^\s*(\d{1,2})[、.)．]\s*(.+)$/
const chineseNumberedRe = /^\s*([一二三四五六七八九十]+)[、.．]\s*(.+)$/
const explicitHeadingRe = /^(?:第[一二三四五六七八九十百\d]+[章节篇部分]|[一二三四五六七八九十]+[、.．])/

function visibleLength(value: string) {
  return Array.from(value.trim()).length
}

function isShortHeadingCandidate(value: string) {
  const text = value.trim()
  const length = visibleLength(text)
  return length >= 2
    && length <= 32
    && !sentenceEndRe.test(text)
    && !bulletRe.test(text)
    && !numberedRe.test(text)
    && !chineseNumberedRe.test(text)
}

function unwrapQuote(value: string) {
  const text = value.trim()
  const pairs: Array<[string, string]> = [
    [`“`, `”`],
    [`「`, `」`],
    [`『`, `』`],
  ]

  for (const [start, end] of pairs) {
    if (text.startsWith(start) && text.endsWith(end) && visibleLength(text) > 2)
      return text.slice(start.length, -end.length).trim()
  }

  const labelled = text.match(/^(?:引用|摘录|金句)[：:]\s*(.+)$/)
  return labelled?.[1]?.trim() || null
}

function nextNonEmptyLine(lines: string[], from: number) {
  for (let index = from + 1; index < lines.length; index += 1) {
    if (lines[index].trim())
      return lines[index].trim()
  }
  return ``
}

/**
 * Conservatively add Markdown structure to pasted plain text for card mode.
 * Existing Markdown is deliberately left untouched.
 */
export function structurePlainTextForCards(input: string): StructuredPasteResult | null {
  const normalized = input
    .replace(/\r\n?/g, `\n`)
    .replace(/[ \t]+$/gm, ``)
    .trim()

  if (!normalized || markdownStructureRe.test(normalized))
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

  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index].trim()
    if (!text) {
      if (output.at(-1) !== ``)
        output.push(``)
      continue
    }

    const quote = unwrapQuote(text)
    if (quote) {
      output.push(`> ${quote}`)
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
      output.push(`${numbered[1]}. ${numbered[2].trim()}`)
      detected.lists += 1
      continue
    }

    const chineseNumbered = text.match(chineseNumberedRe)
    if (chineseNumbered) {
      output.push(`- ${chineseNumbered[2].trim()}`)
      detected.lists += 1
      continue
    }

    if (index === firstContentIndex && isShortHeadingCandidate(text)) {
      output.push(`# ${text}`)
      detected.headings += 1
      continue
    }

    const surroundedBySpace = (index === 0 || !lines[index - 1].trim())
      && (index === lines.length - 1 || !lines[index + 1].trim())
    const nextLine = nextNonEmptyLine(lines, index)
    const introducesLongerBlock = visibleLength(nextLine) >= Math.max(20, visibleLength(text) * 2)
    const introducesStructuredBlock = bulletRe.test(nextLine)
      || numberedRe.test(nextLine)
      || chineseNumberedRe.test(nextLine)
      || unwrapQuote(nextLine) !== null
    if (
      isShortHeadingCandidate(text)
      && (explicitHeadingRe.test(text) || (surroundedBySpace && (introducesLongerBlock || introducesStructuredBlock)))
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
