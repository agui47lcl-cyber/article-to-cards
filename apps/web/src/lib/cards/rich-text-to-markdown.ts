import { structurePlainTextForCards } from './plain-text-to-markdown'

export interface ClipboardTextContent {
  html?: string
  text: string
}

export interface PastedMarkdownResult {
  markdown: string
  source: 'html' | 'plain-text'
}

const meaningfulRichTextSelector = [
  `h1`,
  `h2`,
  `h3`,
  `h4`,
  `h5`,
  `h6`,
  `ul`,
  `ol`,
  `blockquote`,
  `strong`,
  `b`,
  `em`,
  `i`,
  `del`,
  `s`,
  `strike`,
  `pre`,
  `code`,
  `a[href]`,
  `img[src]`,
  `table`,
  `[role="heading"]`,
  `[class*="quote"]`,
  `[data-type*="quote"]`,
  `[style*="border-left"]`,
  `[style*="font-weight"]`,
  `[style*="font-style"]`,
  `[style*="font-size"]`,
  `[style*="text-decoration"]`,
].join(`,`)

const blockTags = new Set([
  `ADDRESS`,
  `ARTICLE`,
  `ASIDE`,
  `DIV`,
  `FIGCAPTION`,
  `FIGURE`,
  `FOOTER`,
  `HEADER`,
  `MAIN`,
  `NAV`,
  `P`,
  `SECTION`,
])

function escapeMarkdownText(value: string) {
  return value
    .replace(/\\/g, `\\\\`)
    .replace(/([*_[\]`])/g, `\\$1`)
}

function normalizeText(value: string) {
  return escapeMarkdownText(value
    .replace(/\u00A0/g, ` `)
    .replace(/[\u200B-\u200D\uFEFF]/g, ``)
    .replace(/\s+/g, ` `))
}

function normalizeMarkdown(value: string) {
  return value
    .replace(/[ \t]+\n/g, `\n`)
    .replace(/\n{3,}/g, `\n\n`)
    .trim()
}

function safeUrl(value: string, image = false) {
  const url = value.trim()
  if (!url || /^javascript:/i.test(url) || /^data:text\/html/i.test(url))
    return ``
  if (image && /^data:/i.test(url) && !/^data:image\//i.test(url))
    return ``
  return url.replace(/[()]/g, `\\$&`)
}

function directChildElements(element: Element, tagName: string) {
  return Array.from(element.children).filter(child => child.tagName === tagName)
}

function styleValue(element: HTMLElement, property: string) {
  return element.style.getPropertyValue(property).trim().toLowerCase()
}

function isBoldStyle(element: HTMLElement) {
  const weight = styleValue(element, `font-weight`)
  return weight === `bold` || weight === `bolder` || Number.parseInt(weight, 10) >= 600
}

function inferHeadingLevel(element: HTMLElement) {
  const tagMatch = element.tagName.match(/^H([1-6])$/)
  if (tagMatch)
    return Number(tagMatch[1])

  if (element.getAttribute(`role`) === `heading`) {
    const level = Number(element.getAttribute(`aria-level`))
    return level >= 1 && level <= 6 ? level : 2
  }

  const styledElement = styleValue(element, `font-size`)
    ? element
    : element.children.length === 1 && element.firstElementChild instanceof HTMLElement
      ? element.firstElementChild
      : null
  if (!styledElement)
    return null

  const fontSize = styleValue(styledElement, `font-size`)
  const match = fontSize.match(/([\d.]+)(px|pt|rem|em)/)
  if (!match || element.textContent!.trim().length > 80)
    return null

  const size = Number(match[1])
  const unit = match[2]
  const pixels = unit === `pt` ? size * (4 / 3) : unit === `rem` || unit === `em` ? size * 16 : size
  if (pixels >= 28)
    return 1
  if (pixels >= 20)
    return 2
  return null
}

function wrapStyledInline(element: HTMLElement, value: string) {
  let content = value
  const decoration = styleValue(element, `text-decoration`)
    || styleValue(element, `text-decoration-line`)
  if (decoration.includes(`line-through`) && content)
    content = `~~${content}~~`
  if (styleValue(element, `font-style`).includes(`italic`) && content)
    content = `*${content}*`
  if (isBoldStyle(element) && content)
    content = `**${content}**`
  return content
}

function renderQuote(value: string) {
  const quote = normalizeMarkdown(value)
  return quote ? `\n\n${quote.split(`\n`).map(line => line ? `> ${line}` : `>`).join(`\n`)}\n\n` : ``
}

function isQuoteLikeBlock(element: HTMLElement) {
  const marker = `${element.className} ${element.getAttribute(`data-type`) || ``} ${element.getAttribute(`data-node-type`) || ``}`.toLowerCase()
  const borderLeft = styleValue(element, `border-left`) || styleValue(element, `border-left-width`)
  return /(?:^|[\s_-])(?:block)?quote(?:[\s_-]|$)/.test(marker)
    || (borderLeft !== `` && borderLeft !== `none` && borderLeft !== `0px` && borderLeft !== `0`)
}

function renderTable(table: HTMLTableElement) {
  const rows = Array.from(table.querySelectorAll(`tr`))
    .map(row => Array.from(row.children)
      .filter(cell => cell.tagName === `TH` || cell.tagName === `TD`)
      .map(cell => normalizeMarkdown(renderChildren(cell))))
    .filter(row => row.some(Boolean))
  if (rows.length === 0)
    return ``

  const width = Math.max(...rows.map(row => row.length))
  const normalizedRows = rows.map(row => Array.from({ length: width }, (_, index) => (row[index] || ``)
    .replace(/\n+/g, `<br>`)
    .replace(/\|/g, `\\|`)))
  const line = (cells: string[]) => `| ${cells.join(` | `)} |`
  return `\n\n${line(normalizedRows[0])}\n${line(Array.from({ length: width }, () => `---`))}${normalizedRows.slice(1).map(row => `\n${line(row)}`).join(``)}\n\n`
}

function renderList(list: Element, depth = 0): string {
  const ordered = list.tagName === `OL`
  const items = directChildElements(list, `LI`)
  return items.map((item, index) => {
    const nestedLists = Array.from(item.children).filter(child => child.tagName === `UL` || child.tagName === `OL`)
    const content = normalizeMarkdown(Array.from(item.childNodes)
      .filter(child => !(child instanceof Element && (child.tagName === `UL` || child.tagName === `OL`)))
      .map(renderNode)
      .join(``))
    const indent = `  `.repeat(depth)
    const marker = ordered ? `${index + 1}. ` : `- `
    const continuationIndent = indent + ` `.repeat(marker.length)
    const itemText = content
      .split(`\n`)
      .map((line, lineIndex) => lineIndex === 0 ? `${indent}${marker}${line}` : `${continuationIndent}${line}`)
      .join(`\n`)
    const nested = nestedLists.map(child => renderList(child, depth + 1)).filter(Boolean)
    return [itemText, ...nested].join(`\n`)
  }).join(`\n`)
}

function renderChildren(node: Node) {
  return Array.from(node.childNodes).map(renderNode).join(``)
}

function renderNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE)
    return normalizeText(node.textContent || ``)
  if (!(node instanceof HTMLElement))
    return ``

  const tag = node.tagName
  if ([`SCRIPT`, `STYLE`, `META`, `NOSCRIPT`, `TEMPLATE`].includes(tag))
    return ``
  if (tag === `BR`)
    return `\n`
  if (tag === `HR`)
    return `\n\n---\n\n`
  if (tag === `PRE`) {
    const code = node.textContent?.replace(/^\n|\n$/g, ``) || ``
    const language = node.querySelector(`code`)?.className.match(/(?:language-|lang-)([\w+-]+)/)?.[1] || ``
    const fence = code.includes(`\`\`\``) ? `\`\`\`\`` : `\`\`\``
    return `\n\n${fence}${language}\n${code}\n${fence}\n\n`
  }
  if (tag === `CODE`) {
    const code = node.textContent || ``
    const fence = code.includes(`\``) ? `\`\`` : `\``
    return `${fence}${code}${fence}`
  }
  if (tag === `UL` || tag === `OL`)
    return `\n\n${renderList(node)}\n\n`
  if (tag === `LI`)
    return renderChildren(node)
  if (tag === `BLOCKQUOTE`)
    return renderQuote(renderChildren(node))
  if (tag === `TABLE`)
    return renderTable(node as HTMLTableElement)
  if (tag === `A`) {
    const label = normalizeMarkdown(renderChildren(node))
    const href = safeUrl(node.getAttribute(`href`) || ``)
    return href && label ? `[${label}](${href})` : label
  }
  if (tag === `IMG`) {
    const src = safeUrl(node.getAttribute(`src`) || ``, true)
    const alt = escapeMarkdownText(node.getAttribute(`alt`) || ``)
    return src ? `![${alt}](${src})` : ``
  }

  let content = renderChildren(node)
  if (tag === `STRONG` || tag === `B`)
    content = content ? `**${content}**` : ``
  else if (tag === `EM` || tag === `I`)
    content = content ? `*${content}*` : ``
  else if (tag === `DEL` || tag === `S` || tag === `STRIKE`)
    content = content ? `~~${content}~~` : ``
  else if (tag === `SPAN`)
    content = wrapStyledInline(node, content)

  if (blockTags.has(tag) && isQuoteLikeBlock(node))
    return renderQuote(content)

  const headingLevel = /^H[1-6]$/.test(tag) || node.getAttribute(`role`) === `heading` || blockTags.has(tag)
    ? inferHeadingLevel(node)
    : null
  if (headingLevel) {
    const heading = normalizeMarkdown(content)
    return heading ? `\n\n${`#`.repeat(headingLevel)} ${heading}\n\n` : ``
  }
  if (blockTags.has(tag)) {
    const block = normalizeMarkdown(content)
    return block ? `\n\n${block}\n\n` : ``
  }
  return content
}

export function richTextHtmlToMarkdown(html: string) {
  const document = new DOMParser().parseFromString(`<!doctype html><html><body></body></html>`, `text/html`)
  document.body.innerHTML = html
  if (!document.body || !document.body.querySelector(meaningfulRichTextSelector))
    return null

  const markdown = normalizeMarkdown(renderChildren(document.body))
  return markdown || null
}

export function convertPastedContentToMarkdown(content: ClipboardTextContent): PastedMarkdownResult | null {
  if (content.html) {
    const markdown = richTextHtmlToMarkdown(content.html)
    if (markdown) {
      const structured = structurePlainTextForCards(markdown)
      const finalMarkdown = structured?.markdown ?? markdown
      if (finalMarkdown !== content.text.trim())
        return { markdown: finalMarkdown, source: `html` }
    }
  }

  const structured = structurePlainTextForCards(content.text)
  return structured ? { markdown: structured.markdown, source: `plain-text` } : null
}
