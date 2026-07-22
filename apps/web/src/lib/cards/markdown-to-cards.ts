import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'

export interface CardPage {
  id: string
  title: string
  markdown: string
  html: string
  estimatedWeight: number
  source: 'manual' | 'auto' | 'mixed'
}

const CARD_SEPARATOR_RE = /^\s*---card---\s*$/gim
const CARD_SEPARATOR_TEST_RE = /^\s*---card---\s*$/im
const HEADING_RE = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/m
const BLOCK_SPLIT_RE = /\n{2,}/g
const AUTO_PAGE_WEIGHT = 680

function stripMarkdownInline(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ``)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, `$1`)
    .replace(/[*_`~]/g, ``)
    .trim()
}

function getPageTitle(markdown: string, fallback: string) {
  const heading = markdown.match(HEADING_RE)?.[1]
  return stripMarkdownInline(heading || fallback)
}

export function normalizeCardSource(markdown: string) {
  const source = markdown.trim()
  if (!source)
    return `# 长图文卡片\n\n在左侧输入内容，或使用 \`---card---\` 手动拆分页面。`
  return source
}

export function renderCardMarkdown(markdown: string) {
  const html = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string

  return DOMPurify.sanitize(html)
}

export function estimateBlockWeight(block: string) {
  const trimmed = block.trim()
  if (!trimmed)
    return 0

  const plain = stripMarkdownInline(trimmed)
  const lines = trimmed.split(`\n`).length
  const isHeading = /^#{1,6}\s+/.test(trimmed)
  const isQuote = /^>\s+/.test(trimmed)
  const isList = /^(\s*[-*+]|\s*\d+\.)\s+/.test(trimmed)
  const isCode = /^```/.test(trimmed)
  const imageCount = (trimmed.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length

  let weight = plain.length + Math.max(0, lines - 1) * 24 + imageCount * 180

  if (isHeading)
    weight += 140
  if (isQuote)
    weight += 90
  if (isList)
    weight += 70
  if (isCode)
    weight += 180

  return weight
}

function isHeadingBlock(block: string) {
  return /^#{1,6}\s+/.test(block.trim())
}

function splitLongParagraph(block: string) {
  const trimmed = block.trim()
  if (estimateBlockWeight(trimmed) <= AUTO_PAGE_WEIGHT)
    return [trimmed]

  const sentences = trimmed
    .split(/(?<=[。！？!?；;])\s*/)
    .map(item => item.trim())
    .filter(Boolean)

  if (sentences.length <= 1)
    return [trimmed]

  const chunks: string[] = []
  let current = ``

  for (const sentence of sentences) {
    const next = current ? `${current}${sentence}` : sentence
    if (current && estimateBlockWeight(next) > AUTO_PAGE_WEIGHT) {
      chunks.push(current)
      current = sentence
    }
    else {
      current = next
    }
  }

  if (current)
    chunks.push(current)

  return chunks
}

export function splitCardBlocks(source: string) {
  return source
    .split(BLOCK_SPLIT_RE)
    .flatMap(splitLongParagraph)
    .map(part => part.trim())
    .filter(Boolean)
}

export function splitCardRawBlocks(source: string) {
  return source
    .split(BLOCK_SPLIT_RE)
    .map(part => part.trim())
    .filter(Boolean)
}

function autoPaginate(source: string) {
  const blocks = splitCardBlocks(source)
  const pages: string[] = []
  let current: string[] = []
  let currentWeight = 0

  for (const block of blocks) {
    const weight = estimateBlockWeight(block)
    const startsNewSection = isHeadingBlock(block)
    const shouldFlush = current.length > 0
      && (
        currentWeight + weight > AUTO_PAGE_WEIGHT
        || (startsNewSection && currentWeight > AUTO_PAGE_WEIGHT * 0.48)
      )

    if (shouldFlush) {
      pages.push(current.join(`\n\n`))
      current = []
      currentWeight = 0
    }

    current.push(block)
    currentWeight += weight
  }

  if (current.length)
    pages.push(current.join(`\n\n`))

  return pages
}

export function hasManualCardBreaks(source: string) {
  return CARD_SEPARATOR_TEST_RE.test(source)
}

export function splitManualCardSections(source: string) {
  return source
    .split(CARD_SEPARATOR_RE)
    .map(part => part.trim())
    .filter(Boolean)
}

export function createCardPage(markdown: string, index: number, source: CardPage['source']): CardPage {
  return {
    id: `card-${index + 1}`,
    title: getPageTitle(markdown, `第 ${index + 1} 页`),
    markdown,
    html: renderCardMarkdown(markdown),
    estimatedWeight: estimateBlockWeight(markdown),
    source,
  }
}

export function buildCardPages(markdown: string): CardPage[] {
  const source = normalizeCardSource(markdown)
  const hasManualBreaks = hasManualCardBreaks(source)
  const parts = hasManualBreaks
    ? splitManualCardSections(source)
        .flatMap(autoPaginate)
    : autoPaginate(source)

  return parts.map((part, index) => createCardPage(part, index, hasManualBreaks ? `mixed` : `auto`))
}
