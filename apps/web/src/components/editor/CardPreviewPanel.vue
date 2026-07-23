<script setup lang="ts">
import { AlertTriangle, Download, Files, SplitSquareHorizontal } from '@lucide/vue'
import dustDotUrl from '@/assets/images/card-dust-dot.svg'
import dustLineUrl from '@/assets/images/card-dust-line.svg'
import dustQuoteMarkUrl from '@/assets/images/card-dust-quote.svg'
import dustTextureUrl from '@/assets/images/card-dust-texture.png'
import greenDotUrl from '@/assets/images/card-green-dot.svg'
import greenLineUrl from '@/assets/images/card-green-line.svg'
import greenPlantUrl from '@/assets/images/card-green-plant.png'
import greenQuoteMarkUrl from '@/assets/images/card-green-quote.svg'
import greenTextureUrl from '@/assets/images/card-green-texture.png'
import quoteMarkUrl from '@/assets/images/card-quote-mark.svg'
import type { CardPage } from '@/lib/cards/markdown-to-cards'
import { exportLongformCardImage, exportLongformCardImages } from '@/services/export/card-images'
import { splitCardCoverSource } from '@/lib/cards/card-cover'
import {
  cardRatios,
  getCardRatio,
  getCardTemplate,
  getCardTemplateStyleVariables,
} from '@/lib/cards/card-templates'
import {
  buildCardPages,
  createCardPage,
  hasManualCardBreaks,
  normalizeCardSource,
  renderCardMarkdown,
  splitCardRawBlocks,
  splitManualCardSections,
} from '@/lib/cards/markdown-to-cards'
import { useEditorStore } from '@/stores/editor'
import { useAuthStore } from '@/stores/auth'
import { usePostStore } from '@/stores/post'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'

const editorStore = useEditorStore()
const authStore = useAuthStore()
const postStore = usePostStore()
const themeStore = useThemeStore()
const uiStore = useUIStore()
const { currentPost } = storeToRefs(postStore)
const { theme, fontFamily, fontSize, primaryColor } = storeToRefs(themeStore)
const { cardTemplate, cardRatio } = storeToRefs(uiStore)

const sourceContent = computed(() => currentPost.value?.content ?? ``)
const pages = ref<CardPage[]>(buildCardPages(sourceContent.value))
const activeIndex = ref(0)
const cardStageInnerRef = useTemplateRef<HTMLElement>(`cardStageInnerRef`)
const activeCardRef = useTemplateRef<HTMLElement>(`activeCardRef`)
const measurementContentRef = useTemplateRef<HTMLElement>(`measurementContentRef`)
const isOverflowing = ref(false)
const isPaginating = ref(false)
const isExporting = ref(false)
const respectManualBreaks = ref(true)
const previewScale = ref(1)
const pageSafeGap = 14
const manualCardBreakRe = /^\s*---card---\s*$/gim
let paginationRun = 0

const ratioOptions = Object.values(cardRatios)
const activeTemplate = computed(() => getCardTemplate(cardTemplate.value))
const activeRatio = computed(() => getCardRatio(cardRatio.value))
const usesReadingProgress = computed(() => cardTemplate.value !== `clean`)
const usesCoverDecoration = computed(() => cardTemplate.value === `dust` || cardTemplate.value === `green`)
const coverAuthorText = computed(() => `作者：${authStore.user?.name || authStore.user?.login || `阿鬼`}`)
const coverDateText = computed(() => {
  const rawDate = currentPost.value?.updateDatetime
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate ?? Date.now())
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  return `日期： ${safeDate.getFullYear()} 年 ${safeDate.getMonth() + 1} 月`
})
const pageIndicatorText = computed(() => {
  const current = String(activeIndex.value + 1).padStart(2, `0`)
  const total = String(pages.value.length).padStart(2, `0`)
  return usesCoverDecoration.value ? `${current} / ${total}` : `${current}/${total}`
})
const templateAssets = computed(() => {
  if (cardTemplate.value === `dust`) {
    return {
      texture: dustTextureUrl,
      textureOpacity: 0.1,
      quoteMark: dustQuoteMarkUrl,
      coverLine: dustLineUrl,
      coverDot: dustDotUrl,
    }
  }

  if (cardTemplate.value === `green`) {
    return {
      texture: greenTextureUrl,
      textureOpacity: 0.2,
      quoteMark: greenQuoteMarkUrl,
      coverLine: greenLineUrl,
      coverDot: greenDotUrl,
    }
  }

  return {
    texture: ``,
    textureOpacity: 0,
    quoteMark: quoteMarkUrl,
    coverLine: ``,
    coverDot: ``,
  }
})
const themeClass = computed(() => `theme-${theme.value}`)
const cardBaseWidth = computed(() => activeRatio.value.width)
const cardBaseHeight = computed(() => activeRatio.value.height)
const cardStyle = computed(() => ({
  ...getCardTemplateStyleVariables(activeTemplate.value),
  '--card-primary': primaryColor.value,
  '--card-font-family': fontFamily.value,
  '--card-font-size': fontSize.value,
  '--card-template-id': activeTemplate.value.id,
  '--card-ratio-id': activeRatio.value.id,
  '--card-width': `${cardBaseWidth.value}px`,
  '--card-height': `${cardBaseHeight.value}px`,
  '--card-quote-mark-image': `url("${templateAssets.value.quoteMark}")`,
  '--card-texture-image': templateAssets.value.texture ? `url("${templateAssets.value.texture}")` : `none`,
  '--card-texture-opacity': templateAssets.value.textureOpacity,
  '--card-cover-line-image': templateAssets.value.coverLine ? `url("${templateAssets.value.coverLine}")` : `none`,
  '--card-cover-dot-image': templateAssets.value.coverDot ? `url("${templateAssets.value.coverDot}")` : `none`,
  '--card-cover-plant-image': cardTemplate.value === `green` ? `url("${greenPlantUrl}")` : `none`,
}))
const cardShellStyle = computed(() => ({
  width: `${cardBaseWidth.value * previewScale.value}px`,
  height: `${cardBaseHeight.value * previewScale.value}px`,
}))
const scaledCardStyle = computed(() => ({
  ...cardStyle.value,
  transform: `scale(${previewScale.value})`,
}))

function joinBlocks(blocks: string[]) {
  return blocks.map(block => block.trim()).filter(Boolean).join(`\n\n`)
}

function measureFits(markdown: string) {
  const content = measurementContentRef.value
  if (!content)
    return true

  content.innerHTML = renderCardMarkdown(markdown)
  if (content.clientHeight <= pageSafeGap)
    return true

  const contentTop = content.getBoundingClientRect().top
  const bottom = Array.from(content.children).reduce((maxBottom, child) => {
    return Math.max(maxBottom, child.getBoundingClientRect().bottom - contentTop)
  }, 0)

  return bottom <= content.clientHeight - pageSafeGap
}

function measureHeadWithContext(currentBlocks: string[], head: string) {
  return measureFits(joinBlocks([...currentBlocks, head]))
}

function splitFencedCodeBlock(block: string, currentBlocks: string[] = []) {
  const trimmed = block.trim()
  const match = trimmed.match(/^(```[^\n]*)(?:\n([\s\S]*?))?\n```$/)
  if (!match)
    return null

  const fenceStart = match[1]
  const body = match[2] ?? ``
  const lines = body.split(`\n`)
  if (lines.length <= 1)
    return null

  let low = 1
  let high = lines.length
  let best = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const head = `${fenceStart}\n${lines.slice(0, mid).join(`\n`)}\n\`\`\``

    if (measureHeadWithContext(currentBlocks, head)) {
      best = mid
      low = mid + 1
    }
    else {
      high = mid - 1
    }
  }

  if (best <= 0)
    return null

  const head = `${fenceStart}\n${lines.slice(0, best).join(`\n`)}\n\`\`\``
  const remaining = lines.slice(best).join(`\n`).trim()
  const tail = remaining ? `${fenceStart}\n${remaining}\n\`\`\`` : ``

  return { head, tail }
}

function splitLineBlock(block: string, currentBlocks: string[] = []) {
  const lines = block.trim().split(`\n`)
  if (lines.length <= 1)
    return null

  let low = 1
  let high = lines.length
  let best = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const head = lines.slice(0, mid).join(`\n`)

    if (measureHeadWithContext(currentBlocks, head)) {
      best = mid
      low = mid + 1
    }
    else {
      high = mid - 1
    }
  }

  if (best <= 0 || best >= lines.length)
    return null

  if (best === 1 && /^#{1,6}\s+/.test(lines[0].trim()))
    return null

  return {
    head: lines.slice(0, best).join(`\n`),
    tail: lines.slice(best).join(`\n`),
  }
}

function getSplittableParagraph(block: string) {
  const trimmed = block.trim()
  if (
    /^#{1,6}\s+/.test(trimmed)
    || /^!\[[^\]]*\]\([^)]+\)/.test(trimmed)
    || /^\|/.test(trimmed)
  ) {
    return null
  }

  const quote = trimmed.match(/^>\s*([\s\S]+)$/)
  if (quote)
    return { prefix: `> `, body: quote[1].replace(/\n>\s*/g, `\n`) }

  if (/^(\s*[-*+]|\s*\d+\.)\s+/m.test(trimmed))
    return null

  return { prefix: ``, body: trimmed }
}

function splitParagraphBlock(block: string, currentBlocks: string[] = []) {
  const splittable = getSplittableParagraph(block)
  if (!splittable)
    return null

  const chars = Array.from(splittable.body)
  if (chars.length <= 1)
    return null

  let low = 1
  let high = chars.length
  let best = 0

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const head = `${splittable.prefix}${chars.slice(0, mid).join(``).trim()}`

    if (measureHeadWithContext(currentBlocks, head)) {
      best = mid
      low = mid + 1
    }
    else {
      high = mid - 1
    }
  }

  if (best <= 0 || best >= chars.length)
    return null

  const head = `${splittable.prefix}${chars.slice(0, best).join(``).trim()}`
  const tailBody = chars.slice(best).join(``).trim()
  const tail = tailBody ? `${splittable.prefix}${tailBody}` : ``

  return { head, tail }
}

function splitBlockToFit(block: string, currentBlocks: string[] = []) {
  return splitFencedCodeBlock(block, currentBlocks)
    || splitLineBlock(block, currentBlocks)
    || splitParagraphBlock(block, currentBlocks)
}

function paginateMeasuredBlocks(blocks: string[]) {
  const pageMarkdowns: string[] = []
  const queue = blocks.map(block => block.trim()).filter(Boolean)
  let currentBlocks: string[] = []
  let guard = 0

  while (queue.length && guard < 2000) {
    guard += 1
    const block = queue.shift()!
    const candidate = joinBlocks([...currentBlocks, block])

    if (measureFits(candidate)) {
      currentBlocks.push(block)
      continue
    }

    if (currentBlocks.length) {
      const split = splitBlockToFit(block, currentBlocks)
      if (split?.head) {
        pageMarkdowns.push(joinBlocks([...currentBlocks, split.head]))
        currentBlocks = []
        if (split.tail)
          queue.unshift(split.tail)
        continue
      }

      pageMarkdowns.push(joinBlocks(currentBlocks))
      currentBlocks = []
      queue.unshift(block)
      continue
    }

    const split = splitBlockToFit(block)
    if (split?.head) {
      pageMarkdowns.push(split.head)
      if (split.tail)
        queue.unshift(split.tail)
      continue
    }

    pageMarkdowns.push(block)
  }

  if (currentBlocks.length)
    pageMarkdowns.push(joinBlocks(currentBlocks))

  return pageMarkdowns.filter(Boolean)
}

function compactMeasuredPages(pageMarkdowns: string[]) {
  const pages = [...pageMarkdowns]
  let index = 0

  while (index < pages.length - 1) {
    const currentBlocks = splitCardRawBlocks(pages[index])
    const nextBlocks = splitCardRawBlocks(pages[index + 1])
    const firstNextBlock = nextBlocks[0]

    if (!firstNextBlock) {
      pages.splice(index + 1, 1)
      continue
    }

    const movedCandidate = joinBlocks([...currentBlocks, firstNextBlock])
    if (measureFits(movedCandidate)) {
      pages[index] = movedCandidate
      pages[index + 1] = joinBlocks(nextBlocks.slice(1))
      if (!pages[index + 1])
        pages.splice(index + 1, 1)
      continue
    }

    const split = splitBlockToFit(firstNextBlock, currentBlocks)
    if (split?.head) {
      pages[index] = joinBlocks([...currentBlocks, split.head])
      pages[index + 1] = joinBlocks([split.tail, ...nextBlocks.slice(1)])
      continue
    }

    index += 1
  }

  return pages.filter(Boolean)
}

function buildMeasuredPages(markdown: string) {
  const source = normalizeCardSource(markdown)
  const coverSource = usesCoverDecoration.value
    ? splitCardCoverSource(source, currentPost.value?.title ?? `长图文卡片`)
    : null
  const bodySource = coverSource?.bodyMarkdown ?? source
  const hasManualBreaks = respectManualBreaks.value && hasManualCardBreaks(bodySource)
  const sections = hasManualBreaks
    ? splitManualCardSections(bodySource)
    : bodySource ? [bodySource.replace(manualCardBreakRe, `\n\n`)] : []
  const pageMarkdowns = sections.flatMap(section => compactMeasuredPages(paginateMeasuredBlocks(splitCardRawBlocks(section))))
  const pageSource = hasManualBreaks ? `mixed` : `auto`
  const allPageMarkdowns = coverSource
    ? [coverSource.coverMarkdown, ...pageMarkdowns]
    : pageMarkdowns

  return allPageMarkdowns.map((pageMarkdown, index) => createCardPage(pageMarkdown, index, pageSource))
}

function buildInitialPages(markdown: string) {
  if (!usesCoverDecoration.value)
    return buildCardPages(markdown)

  const coverSource = splitCardCoverSource(markdown, currentPost.value?.title ?? `长图文卡片`)
  const bodyPages = coverSource.bodyMarkdown ? buildCardPages(coverSource.bodyMarkdown) : []
  return [
    createCardPage(coverSource.coverMarkdown, 0, `auto`),
    ...bodyPages.map((page, index) => createCardPage(page.markdown, index + 1, page.source)),
  ]
}

function refreshPages() {
  pages.value = buildInitialPages(sourceContent.value)
  isPaginating.value = true
  const run = ++paginationRun

  nextTick(() => {
    if (run !== paginationRun)
      return

    pages.value = buildMeasuredPages(sourceContent.value)
    if (activeIndex.value > pages.value.length - 1)
      activeIndex.value = Math.max(0, pages.value.length - 1)
    isPaginating.value = false
    nextTick(checkOverflow)
  })
}

function runAutoPagination() {
  respectManualBreaks.value = false
  refreshPages()
  toast.success(`已按当前样式重新自动分页`)
}

async function exportCurrentCard() {
  const card = activeCardRef.value
  const page = pages.value[activeIndex.value]
  if (!card || !page)
    return

  isExporting.value = true
  try {
    await exportLongformCardImage(card, {
      title: `${currentPost.value?.title || page.title}-${String(activeIndex.value + 1).padStart(2, `0`)}`,
    })
    toast.success(`已导出当前页`)
  }
  finally {
    isExporting.value = false
  }
}

async function exportAllCards() {
  const card = activeCardRef.value
  if (!card || pages.value.length === 0)
    return

  isExporting.value = true
  try {
    await exportLongformCardImages(card, {
      title: currentPost.value?.title || `长图文`,
      pages: pages.value,
    })
    toast.success(`已打包导出全部卡片`)
  }
  finally {
    isExporting.value = false
  }
}

function insertCardBreak() {
  respectManualBreaks.value = true
  const page = pages.value[activeIndex.value]
  const editor = editorStore.editor
  if (!page || !editor) {
    editorStore.insertAtCursor(`\n\n---card---\n\n`)
    toast.success(`已插入分页`)
    return
  }

  const content = editor.state.doc.toString()
  const pageStart = content.indexOf(page.markdown)
  const insertAt = pageStart === -1 ? null : pageStart + page.markdown.length

  if (insertAt == null) {
    editorStore.insertAtCursor(`\n\n---card---\n\n`)
    toast.success(`已在光标处插入分页`)
    return
  }

  editor.dispatch({
    changes: { from: insertAt, insert: `\n\n---card---\n\n` },
    selection: { anchor: insertAt + `\n\n---card---\n\n`.length },
  })
  editor.focus()
  toast.success(`已在当前卡片后插入分页`)
}

function checkOverflow() {
  const card = activeCardRef.value
  const content = card?.querySelector(`.card-content`) as HTMLElement | null
  if (!content) {
    isOverflowing.value = false
    return
  }
  isOverflowing.value = content.scrollHeight > content.clientHeight + 2
}

function updatePreviewScale() {
  const container = cardStageInnerRef.value
  if (!container)
    return

  const availableWidth = container.clientWidth
  previewScale.value = Math.min(1, Math.max(0.55, availableWidth / cardBaseWidth.value))
  nextTick(checkOverflow)
}

let resizeObserver: ResizeObserver | null = null

watch([activeIndex, cardTemplate, cardRatio, theme, fontFamily, fontSize, primaryColor], () => {
  nextTick(() => {
    updatePreviewScale()
    checkOverflow()
  })
})

watch([sourceContent, cardTemplate, cardRatio, theme, fontFamily, fontSize, primaryColor], () => {
  refreshPages()
}, { immediate: true })

onMounted(() => {
  nextTick(() => {
    refreshPages()
    updatePreviewScale()
    const container = cardStageInnerRef.value
    if (!container)
      return

    resizeObserver = new ResizeObserver(updatePreviewScale)
    resizeObserver.observe(container)
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="card-mode-preview flex h-full w-full overflow-hidden" :style="cardStyle">
    <aside class="card-thumbs hidden w-32 shrink-0 overflow-y-auto border-r p-3 md:block">
      <button
        v-for="(page, index) in pages"
        :key="page.id"
        class="thumb-button"
        :class="{ active: activeIndex === index }"
        :title="page.title"
        @click="activeIndex = index"
      >
        <span class="thumb-page">{{ index + 1 }}</span>
        <span class="thumb-title">{{ page.title }}</span>
      </button>
    </aside>

    <div id="card-preview-scroll" class="card-stage min-w-0 flex-1 overflow-y-auto p-5">
      <div ref="cardStageInnerRef" class="mx-auto flex w-full max-w-[520px] min-w-0 flex-col items-center gap-4">
        <div class="card-toolbar flex w-full flex-nowrap items-center justify-center rounded border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span class="toolbar-options">
            <label class="toolbar-select-label">
              <span class="sr-only">比例</span>
              <select v-model="cardRatio" class="toolbar-select ratio-select" aria-label="长图文比例">
                <option
                  v-for="option in ratioOptions"
                  :key="option.id"
                  :value="option.id"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>
          </span>
          <span class="toolbar-actions">
            <button type="button" class="toolbar-action-button" :disabled="isPaginating || isExporting" @click="runAutoPagination">
              {{ isPaginating ? '分页中' : '自动分页' }}
            </button>
            <span class="download-menu">
              <button type="button" class="toolbar-action-button" :disabled="isExporting" aria-haspopup="menu">
                下载
              </button>
              <span class="download-menu-panel" role="menu">
                <button type="button" class="download-menu-item" :disabled="isExporting" role="menuitem" @click="exportCurrentCard">
                  <Download class="size-3.5" />
                  单页
                </button>
                <button type="button" class="download-menu-item" :disabled="isExporting" role="menuitem" @click="exportAllCards">
                  <Files class="size-3.5" />
                  全部
                </button>
              </span>
            </span>
          </span>
        </div>

        <div v-if="pages[activeIndex]" class="card-scale-shell" :style="cardShellStyle">
          <article
            ref="activeCardRef"
            class="xiaohongshu-card"
            :class="[
              activeTemplate.className,
              cardRatio === '3-4' ? 'ratio-3-4' : 'ratio-4-5',
              themeClass,
              { 'is-cover-page': activeIndex === 0 },
            ]"
            :style="scaledCardStyle"
          >
            <header class="card-page-header">
              <span>{{ usesReadingProgress ? '阅读进度' : 'Longform Card' }}</span>
              <span>{{ usesReadingProgress ? pageIndicatorText : String(activeIndex + 1).padStart(2, '0') }}</span>
            </header>

            <span v-if="usesCoverDecoration" class="card-cover-motif" aria-hidden="true">
              <span class="card-cover-line" />
              <span class="card-cover-dot" />
              <span v-if="cardTemplate === 'green'" class="card-cover-plant" />
            </span>

            <section class="card-content" v-html="pages[activeIndex].html" />

            <div v-if="usesCoverDecoration" class="card-cover-meta">
              <span>{{ coverAuthorText }}</span>
              <span>{{ coverDateText }}</span>
            </div>

            <footer class="card-page-footer">
              <span>Markdown to Cards</span>
              <span>{{ activeIndex + 1 }} / {{ pages.length }}</span>
            </footer>
          </article>
        </div>

        <div v-if="isOverflowing" class="overflow-warning flex w-full flex-wrap items-center gap-2 rounded border px-3 py-2 text-xs">
          <AlertTriangle class="mt-0.5 size-4 shrink-0" />
          <span class="min-w-0 flex-1">当前页内容可能溢出。可以手动拆页，或切换 4:5 增加可用高度。</span>
          <button class="insert-break-button" @click="insertCardBreak">
            <SplitSquareHorizontal class="size-3.5" />
            插入分页
          </button>
        </div>

        <div class="mobile-thumbs grid w-full grid-cols-4 gap-2 md:hidden">
          <button
            v-for="(page, index) in pages"
            :key="page.id"
            class="mobile-thumb-button"
            :class="{ active: activeIndex === index }"
            @click="activeIndex = index"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
      <BackTop target="card-preview-scroll" :right="24" :bottom="24" />
    </div>

    <div class="stage-page-indicator" aria-live="polite">
      {{ activeIndex + 1 }} / {{ pages.length }}
    </div>

    <article
      class="xiaohongshu-card measurement-card"
      :class="[
        activeTemplate.className,
        cardRatio === '3-4' ? 'ratio-3-4' : 'ratio-4-5',
        themeClass,
      ]"
      :style="cardStyle"
      aria-hidden="true"
    >
      <header class="card-page-header">
        <span>{{ usesReadingProgress ? '阅读进度' : 'Longform Card' }}</span>
        <span>{{ usesReadingProgress ? '00/00' : '00' }}</span>
      </header>
      <section ref="measurementContentRef" class="card-content" />
      <footer class="card-page-footer">
        <span>Markdown to Cards</span>
        <span>0 / 0</span>
      </footer>
    </article>
  </div>
</template>

<style lang="less" scoped>
.card-mode-preview {
  position: relative;
  background:
    radial-gradient(circle at 20% 10%, rgb(255 248 238 / 0.9), transparent 28%),
    linear-gradient(135deg, #f7f5f0 0%, #eef4f2 45%, #f7f8fb 100%);
}

.card-thumbs {
  background: hsl(var(--background) / 0.86);
  backdrop-filter: blur(12px);
}

.thumb-button {
  display: flex;
  width: 100%;
  min-height: 70px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  padding: 10px;
  text-align: left;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;

  & + & {
    margin-top: 10px;
  }

  &:hover,
  &.active {
    border-color: var(--card-primary, #5d8d7b);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--card-primary, #5d8d7b) 18%, transparent);
  }
}

.thumb-page {
  color: var(--card-primary, #5d8d7b);
  font-size: 12px;
  font-weight: 700;
}

.thumb-title {
  display: -webkit-box;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.card-toolbar {
  box-sizing: border-box;
  min-height: 40px;
  column-gap: 14px;
  padding-right: 12px;
  padding-left: 12px;
}

.toolbar-options,
.toolbar-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.toolbar-select-label {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  white-space: nowrap;
}

.toolbar-select {
  box-sizing: border-box;
  height: 28px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  padding: 0 30px 0 10px;
  color: hsl(var(--foreground));
  font-weight: 650;
  outline: none;

  &:hover,
  &:focus-visible {
    border-color: var(--card-primary, #5d8d7b);
  }
}

.ratio-select {
  width: 72px;
}

.toolbar-actions {
  white-space: nowrap;
}

.stage-page-indicator {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 20;
  min-width: 54px;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background: hsl(var(--background) / 88%);
  padding: 5px 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  text-align: center;
  box-shadow: 0 6px 18px rgb(15 23 42 / 10%);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.toolbar-action-button {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  background: hsl(var(--accent));
  padding: 0 8px;
  color: hsl(var(--accent-foreground));
  font-weight: 650;
  transition: opacity 0.16s ease, transform 0.12s ease;

  &:hover {
    opacity: 0.88;
  }

  &:active {
    transform: scale(0.98);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.download-menu {
  position: relative;
  display: inline-flex;
}

.download-menu::after {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  height: 8px;
  content: '';
}

.download-menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  display: flex;
  min-width: 104px;
  flex-direction: column;
  gap: 4px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 6px;
  box-shadow: 0 12px 28px rgb(15 23 42 / 12%);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
  visibility: hidden;
}

.download-menu:hover .download-menu-panel,
.download-menu:focus-within .download-menu-panel {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
  visibility: visible;
}

.download-menu-item {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  padding: 0 8px;
  color: hsl(var(--foreground));
  font-weight: 650;
  white-space: nowrap;
  transition: background 0.16s ease, color 0.16s ease;

  &:hover,
  &:focus-visible {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.card-scale-shell {
  position: relative;
  max-width: 100%;
  flex: 0 0 auto;
}

.xiaohongshu-card {
  width: var(--card-width, 420px);
  min-width: var(--card-width, 420px);
  max-width: var(--card-width, 420px);
  height: var(--card-height, 560px);
  min-height: var(--card-height, 560px);
  max-height: var(--card-height, 560px);
  flex: 0 0 auto;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--card-primary, #5d8d7b) 18%, #e2dcd2);
  border-radius: 8px;
  background: #fffdf8;
  box-shadow: 0 24px 70px color-mix(in srgb, var(--card-primary, #5d8d7b) 16%, transparent);
  color: #242723;
  font-family: var(--card-font-family, -apple-system-font, BlinkMacSystemFont, 'Helvetica Neue', sans-serif);
  transform-origin: top left;
}

.ratio-3-4 {
  aspect-ratio: 3 / 4;
}

.ratio-4-5 {
  aspect-ratio: 4 / 5;
}

.clean-template {
  display: flex;
  flex-direction: column;
  padding: var(--card-page-padding-top, 26px) var(--card-page-padding-x, 28px) var(--card-page-padding-bottom, 20px);
}

.note-template {
  display: flex;
  flex-direction: column;
  border-color: rgb(61 47 23 / 12%);
  border-radius: 2px;
  background: #f6f5e3;
  padding: var(--card-page-padding-top, 26px) var(--card-page-padding-x, 26px) var(--card-page-padding-bottom, 20px);
  box-shadow: 0 24px 64px rgb(61 47 23 / 14%);
}

.note-template .card-page-header {
  color: rgb(0 0 0 / 50%);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.note-template .card-page-footer {
  display: none;
}

.card-page-header,
.card-page-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  color: #8b8d86;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
}

.card-page-header {
  padding-bottom: var(--card-header-gap, 18px);
}

.card-page-footer {
  padding-top: var(--card-footer-gap, 16px);
  border-top: 1px solid #ebe5d8;
}

.card-content {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.mobile-thumb-button {
  height: 34px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--background));
  font-size: 12px;

  &.active {
    border-color: var(--card-primary, #5d8d7b);
    background: color-mix(in srgb, var(--card-primary, #5d8d7b) 12%, white);
    color: var(--card-primary, #315f50);
    font-weight: 700;
  }
}

.overflow-warning {
  border-color: #f0c36a;
  background: #fff8e8;
  color: #7a5216;
}

.insert-break-button {
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  background: #7a5216;
  padding: 0 10px;
  color: white;
  font-weight: 700;
  transition: transform 0.12s ease, opacity 0.12s ease;

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.98);
  }
}

:deep(.card-content) {
  h1,
  h2,
  h3 {
    color: #20251f;
    letter-spacing: 0;
  }

  h1 {
    margin: 0 0 18px;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h1-scale, 1.9));
    font-weight: 800;
    line-height: 1.16;
  }

  h2 {
    margin: 0 0 14px;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h2-scale, 1.38));
    font-weight: 760;
    line-height: 1.22;
  }

  h3 {
    margin: 0 0 10px;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h3-scale, 1.08));
    font-weight: 720;
    line-height: 1.3;
  }

  p {
    margin: 0 0 var(--card-paragraph-gap, 13px);
    color: #343832;
    font-size: var(--card-font-size, 16px);
    line-height: var(--card-body-line-height, 1.72);
  }

  strong {
    color: var(--card-primary, #255c4d);
    font-weight: 800;
  }

  blockquote {
    margin: 16px 0;
    border-left: 4px solid color-mix(in srgb, var(--card-primary, #7da892) 72%, white);
    border-radius: 0 8px 8px 0;
    background: color-mix(in srgb, var(--card-primary, #7da892) 10%, white);
    padding: 12px 14px;
  }

  blockquote p {
    margin: 0;
    color: color-mix(in srgb, var(--card-primary, #2b5146) 72%, #222);
    font-weight: 650;
  }

  ul,
  ol {
    margin: 0 0 14px;
    padding-left: 20px;
    color: #343832;
    font-size: var(--card-font-size, 16px);
    line-height: 1.68;
  }

  li::marker {
    color: var(--card-primary, #5d8d7b);
  }

  li + li {
    margin-top: 6px;
  }

  img {
    display: block;
    max-width: 100%;
    max-height: var(--card-image-max-height, 190px);
    margin: 14px auto;
    border-radius: 8px;
    object-fit: cover;
  }

  code {
    border-radius: 4px;
    background: color-mix(in srgb, var(--card-primary, #5d8d7b) 10%, #f1eee6);
    padding: 2px 5px;
    color: var(--card-primary, #2e5e50);
    font-size: 0.92em;
  }

  pre {
    max-height: var(--card-code-block-max-height, 160px);
    overflow: hidden;
    border-radius: 8px;
    background: #242723;
    padding: 12px;
    color: #f8f6ee;
    font-size: 12px;
    line-height: 1.6;
  }
}

.note-template :deep(.card-content) {
  h1 {
    margin-bottom: var(--card-title-body-gap, 37.33px);
    color: #1d2129;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h1-scale, 2.5));
    font-weight: 850;
    line-height: 1.22;
  }

  h2 {
    margin: var(--card-title-body-gap, 37.33px) 0;
    color: #1d2129;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h2-scale, 1.5));
    font-weight: 850;
    line-height: 1.3;
  }

  h3 {
    display: inline;
    color: #1d2129;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h3-scale, 1.25));
    font-weight: 850;
    line-height: 1.45;
    background: linear-gradient(transparent 58%, rgb(0 0 0 / 18%) 58%);
  }

  p {
    color: #1d2129;
    font-size: var(--card-font-size, 16px);
  }

  strong {
    background: linear-gradient(transparent 62%, color-mix(in srgb, var(--card-primary, #715b32) 20%, transparent) 62%);
    color: #1d2129;
    font-weight: 850;
  }

  blockquote {
    position: relative;
    margin-top: 42px;
    border-left: 0;
    border-radius: 8px;
    background: rgb(61 47 23 / 7%);
    padding: 14px 10px;

    &::before {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 5px;
      width: 29px;
      height: 18px;
      background: var(--card-quote-mark-image) center / 100% 100% no-repeat;
      content: '';
    }
  }

  blockquote p {
    color: #1d2129;
    font-weight: 400;
  }

  ul,
  ol {
    margin-top: 20px;
    padding-left: 22px;
    color: #1d2129;
    line-height: 2;
  }

  li::marker {
    color: #1d2129;
  }

  code {
    background: rgb(61 47 23 / 9%);
    color: #1d2129;
  }

  img {
    border-radius: 0;
    filter: saturate(0.82) sepia(0.08);
  }

  pre {
    background: #292923;
    color: #f6f5e3;
  }
}

.theme-grace {
  border-radius: 4px;
  background: #fffaf2;
}

.theme-simple {
  border-radius: 2px;
  background: #ffffff;
  box-shadow: 0 18px 48px color-mix(in srgb, var(--card-primary, #5d8d7b) 10%, transparent);
}

.dust-template,
.green-template {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  padding: var(--card-page-padding-top, 23.33px) var(--card-page-padding-x, 37.33px) var(--card-page-padding-bottom, 23.33px);
  font-family: 'Dinglie Songti', 'Songti SC', SimSun, serif;
  font-weight: 400;
  box-shadow: 0 24px 64px rgb(30 22 16 / 18%);
}

.dust-template {
  background: #8a1e1e;
  color: rgb(255 255 255 / 90%);
}

.green-template {
  background: #acc594;
  color: rgb(0 0 0 / 90%);
}

.dust-template::before,
.green-template::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: var(--card-texture-image) center / cover no-repeat;
  content: '';
  opacity: var(--card-texture-opacity, 0.1);
  pointer-events: none;
}

.dust-template .card-page-header,
.green-template .card-page-header {
  position: relative;
  z-index: 2;
  font-family: inherit;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.dust-template .card-page-header {
  color: rgb(255 255 255 / 60%);
}

.green-template .card-page-header {
  color: rgb(0 0 0 / 60%);
}

.dust-template .card-page-footer,
.green-template .card-page-footer {
  display: none;
}

.dust-template .card-content,
.green-template .card-content {
  position: relative;
  z-index: 2;
}

.dust-template :deep(.card-content *),
.green-template :deep(.card-content *) {
  font-family: 'Dinglie Songti', 'Songti SC', SimSun, serif !important;
}

.card-cover-motif {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: none;
  pointer-events: none;
}

.dust-template.is-cover-page .card-cover-motif,
.green-template.is-cover-page .card-cover-motif {
  display: block;
}

.card-cover-meta {
  display: none;
}

.dust-template.is-cover-page .card-cover-meta,
.green-template.is-cover-page .card-cover-meta {
  position: absolute;
  z-index: 2;
  right: calc(80px * 420 / 900);
  bottom: calc(80px * 420 / 900);
  left: calc(80px * 420 / 900);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: 'Dinglie Songti', 'Songti SC', SimSun, serif;
  font-size: calc(32px * 420 / 900);
  font-weight: 400;
  line-height: normal;
  white-space: nowrap;
}

.dust-template.is-cover-page .card-cover-meta {
  color: rgb(255 255 255 / 60%);
}

.green-template.is-cover-page .card-cover-meta {
  color: rgb(0 0 0 / 60%);
}

.card-cover-line,
.card-cover-dot,
.card-cover-plant {
  position: absolute;
  display: block;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.card-cover-line {
  background-image: var(--card-cover-line-image);
  transform-origin: center;
}

.card-cover-dot {
  width: calc(44px * 420 / 900);
  height: calc(44px * 420 / 900);
  background-image: var(--card-cover-dot-image);
}

.card-cover-plant {
  top: calc(728px * 420 / 900);
  left: calc(349px * 420 / 900);
  width: calc(664px * 420 / 900);
  height: calc(470px * 420 / 900);
  background-image: var(--card-cover-plant-image);
  mix-blend-mode: difference;
  opacity: 0.22;
  transform: rotate(72.58deg);
  transform-origin: center;
}

.dust-template.is-cover-page .card-cover-line {
  top: calc(636px * 420 / 900);
  left: calc(335px * 420 / 900);
  width: calc(581px * 420 / 900);
  height: calc(5px * 420 / 900);
  transform: rotate(118.02deg);
}

.dust-template.is-cover-page .card-cover-dot {
  top: calc(851px * 420 / 900);
  left: calc(723px * 420 / 900);
}

.green-template.is-cover-page .card-cover-line {
  top: calc(578px * 420 / 900);
  left: calc(406px * 420 / 900);
  width: calc(542px * 420 / 900);
  height: calc(5px * 420 / 900);
  transform: rotate(104.65deg);
}

.green-template.is-cover-page .card-cover-dot {
  top: calc(810px * 420 / 900);
  left: calc(701px * 420 / 900);
}

.dust-template.is-cover-page .card-content,
.green-template.is-cover-page .card-content {
  position: absolute;
  z-index: 2;
  min-height: 0;
  overflow: visible;
}

.dust-template.is-cover-page .card-content {
  top: calc(253px * 420 / 900);
  left: calc(80px * 420 / 900);
  width: calc(521px * 420 / 900);
}

.green-template.is-cover-page .card-content {
  top: calc(165px * 420 / 900);
  left: calc(80px * 420 / 900);
  width: calc(484px * 420 / 900);
  height: calc(632px * 420 / 900);
}

.dust-template.is-cover-page :deep(.card-content h1) {
  width: 100%;
  margin: 0;
  font-size: calc(100px * 420 / 900);
  font-weight: 400;
  line-height: 1.2;
}

.green-template.is-cover-page :deep(.card-content h1) {
  width: 100%;
  height: 100%;
  margin: 0;
  font-size: calc(110px * 420 / 900);
  font-weight: 400;
  line-height: calc(120 / 110);
  text-align: center;
  text-orientation: mixed;
  white-space: normal;
  overflow-wrap: break-word;
  word-break: normal;
  writing-mode: vertical-lr;
}

.dust-template :deep(.card-content),
.green-template :deep(.card-content) {
  h1,
  h2,
  h3,
  p,
  ul,
  ol,
  blockquote,
  code,
  pre {
    font-family: inherit;
    font-weight: 400;
  }

  h1 {
    margin: 0 0 var(--card-title-body-gap, 37.33px);
    font-size: calc(var(--card-font-size, 16px) * var(--card-h1-scale, 2.5));
    line-height: 1.25;
  }

  h2 {
    margin: 0 0 var(--card-title-body-gap, 37.33px);
    font-size: calc(var(--card-font-size, 16px) * var(--card-h2-scale, 2));
    line-height: 1.3;
  }

  h2:not(:first-child) {
    margin-top: var(--card-title-body-gap, 37.33px);
  }

  h3 {
    display: inline;
    font-size: calc(var(--card-font-size, 16px) * var(--card-h3-scale, 1.25));
    line-height: 1.45;
  }

  p {
    font-size: var(--card-font-size, 16px);
    line-height: var(--card-body-line-height, 1.5);
  }

  ul,
  ol {
    margin: 0 0 var(--card-paragraph-gap, 18.67px);
    padding-left: 22px;
    font-size: var(--card-font-size, 16px);
    line-height: var(--card-body-line-height, 1.5);
  }

  li + li {
    margin-top: 4px;
  }

  blockquote {
    position: relative;
    margin: 42px 0 var(--card-paragraph-gap, 18.67px);
    border: 0;
    border-radius: 7.47px;
    padding: 9.33px;

    &::before {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 5px;
      width: 29px;
      height: 18px;
      background: var(--card-quote-mark-image) center / 100% 100% no-repeat;
      content: '';
    }
  }

  blockquote p {
    margin: 0;
    font-weight: 400;
  }

  img {
    border-radius: 0;
  }

  code {
    border-radius: 2px;
  }
}

.dust-template :deep(.card-content) {
  h1,
  h2,
  h3,
  p,
  ul,
  ol,
  blockquote p,
  strong,
  code {
    color: rgb(255 255 255 / 90%);
  }

  h3,
  strong {
    background: linear-gradient(transparent 58%, rgb(255 255 14 / 22%) 58%);
  }

  blockquote {
    background: rgb(255 255 14 / 12%);
  }

  li::marker {
    color: rgb(255 255 255 / 90%);
  }

  code {
    background: rgb(255 255 255 / 12%);
  }

  pre {
    background: rgb(38 10 10 / 72%);
    color: rgb(255 255 255 / 90%);
  }
}

.green-template :deep(.card-content) {
  h1,
  h2,
  h3,
  p,
  ul,
  ol,
  blockquote p,
  strong,
  code {
    color: rgb(0 0 0 / 90%);
  }

  h3,
  strong {
    background: linear-gradient(transparent 58%, rgb(0 0 0 / 12%) 58%);
  }

  blockquote {
    background: rgb(0 0 0 / 7%);
  }

  li::marker {
    color: rgb(0 0 0 / 90%);
  }

  code {
    background: rgb(0 0 0 / 9%);
  }

  pre {
    background: rgb(20 38 16 / 76%);
    color: rgb(255 255 255 / 90%);
  }
}

// 必须放在模板样式之后，避免模板的 position: relative 让测量卡片参与预览区布局。
.measurement-card {
  position: fixed;
  top: 0;
  left: -10000px;
  z-index: -1;
  visibility: hidden;
  pointer-events: none;
  transform: none;
}
</style>
