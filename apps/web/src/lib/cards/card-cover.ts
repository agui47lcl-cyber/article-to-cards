const COVER_HEADING_RE = /^\s{0,3}#(?!#)\s+(.+?)\s*#*\s*$/m

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
