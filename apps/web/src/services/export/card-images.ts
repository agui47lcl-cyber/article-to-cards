import { sanitizeTitle } from '@md/shared/utils/basicHelpers'
import { downloadFile } from '@md/shared/utils/fileHelpers'
import { toPng } from 'html-to-image'
import type { CardPage } from '@/lib/cards/markdown-to-cards'

interface ExportCardOptions {
  title: string
  pixelRatio?: number
}

interface ExportAllCardsOptions extends ExportCardOptions {
  pages: CardPage[]
}

function delay(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms))
}

function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then(response => response.blob())
}

function createExportHost(card: HTMLElement) {
  const host = document.createElement(`div`)
  host.style.cssText = `position:fixed;left:-99999px;top:0;z-index:-1;visibility:visible;pointer-events:none;`

  const clone = card.cloneNode(true) as HTMLElement
  clone.style.transform = `none`
  clone.style.transformOrigin = `top left`

  host.appendChild(clone)
  document.body.appendChild(host)

  return {
    card: clone,
    cleanup: () => host.remove(),
  }
}

function updateCardClone(clone: HTMLElement, page: CardPage, index: number, total: number) {
  const pageNumber = String(index + 1).padStart(2, `0`)
  const headerNumber = clone.querySelector(`.card-page-header span:last-child`)
  const content = clone.querySelector(`.card-content`)
  const footerNumber = clone.querySelector(`.card-page-footer span:last-child`)

  if (headerNumber)
    headerNumber.textContent = pageNumber
  if (content)
    content.innerHTML = page.html
  if (footerNumber)
    footerNumber.textContent = `${index + 1} / ${total}`
}

async function renderCardToPng(card: HTMLElement, pixelRatio: number) {
  await delay(80)
  return toPng(card, {
    cacheBust: true,
    pixelRatio,
    skipFonts: true,
    style: {
      margin: `0`,
      transform: `none`,
    },
  })
}

export async function exportLongformCardImage(card: HTMLElement, options: ExportCardOptions) {
  const exportNode = createExportHost(card)

  try {
    const url = await renderCardToPng(exportNode.card, options.pixelRatio ?? 2)
    downloadFile(url, `${sanitizeTitle(options.title)}.png`, `image/png`)
  }
  finally {
    exportNode.cleanup()
  }
}

export async function exportLongformCardImages(card: HTMLElement, options: ExportAllCardsOptions) {
  const exportNode = createExportHost(card)

  try {
    const JSZip = (await import(`jszip`)).default
    const zip = new JSZip()
    const safeTitle = sanitizeTitle(options.title)
    const pixelRatio = options.pixelRatio ?? 2

    for (const [index, page] of options.pages.entries()) {
      updateCardClone(exportNode.card, page, index, options.pages.length)
      const url = await renderCardToPng(exportNode.card, pixelRatio)
      zip.file(`${safeTitle}-${String(index + 1).padStart(2, `0`)}.png`, await dataUrlToBlob(url))
    }

    const blob = await zip.generateAsync({ type: `blob` })
    const url = URL.createObjectURL(blob)
    downloadFile(url, `${safeTitle}-cards.zip`, `application/zip`)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  finally {
    exportNode.cleanup()
  }
}
