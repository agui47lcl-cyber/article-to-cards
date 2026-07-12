<script setup lang="ts">
import { AlertTriangle, LayoutTemplate, SplitSquareHorizontal } from '@lucide/vue'
import type { CardPage } from '@/lib/cards/markdown-to-cards'
import { buildCardPages } from '@/lib/cards/markdown-to-cards'
import { useEditorStore } from '@/stores/editor'
import { usePostStore } from '@/stores/post'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'

const editorStore = useEditorStore()
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
const isOverflowing = ref(false)
const previewScale = ref(1)
const cardBaseWidth = 420
const cardBaseHeight = computed(() => cardRatio.value === `3-4` ? 560 : 525)

const templateLabel = computed(() => cardTemplate.value === `clean` ? `清爽白底` : `小红书笔记`)
const ratioLabel = computed(() => cardRatio.value === `3-4` ? `3:4` : `4:5`)
const pagingLabel = computed(() => pages.value[0]?.source === `auto` ? `自动分页` : `混合分页`)
const themeClass = computed(() => `theme-${theme.value}`)
const cardStyle = computed(() => ({
  '--card-primary': primaryColor.value,
  '--card-font-family': fontFamily.value,
  '--card-font-size': fontSize.value,
  '--card-width': `${cardBaseWidth}px`,
  '--card-height': `${cardBaseHeight.value}px`,
}))
const cardShellStyle = computed(() => ({
  width: `${cardBaseWidth * previewScale.value}px`,
  height: `${cardBaseHeight.value * previewScale.value}px`,
}))
const scaledCardStyle = computed(() => ({
  ...cardStyle.value,
  transform: `scale(${previewScale.value})`,
}))

function refreshPages() {
  pages.value = buildCardPages(sourceContent.value)
  if (activeIndex.value > pages.value.length - 1)
    activeIndex.value = Math.max(0, pages.value.length - 1)
  nextTick(checkOverflow)
}

function insertCardBreak() {
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
  previewScale.value = Math.min(1, Math.max(0.55, availableWidth / cardBaseWidth))
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
        <div class="card-toolbar flex w-full items-center justify-between rounded border bg-background px-3 py-2 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-2">
            <LayoutTemplate class="size-4" />
            长图文卡片 · {{ templateLabel }} · {{ ratioLabel }}
          </span>
          <span>{{ pagingLabel }} · {{ activeIndex + 1 }} / {{ pages.length }}</span>
        </div>

        <div class="card-controls grid w-full grid-cols-2 gap-2 rounded border bg-background p-2 text-xs md:grid-cols-4">
          <button
            class="control-button"
            :class="{ active: cardTemplate === 'clean' }"
            @click="uiStore.setCardTemplate('clean')"
          >
            清爽白底
          </button>
          <button
            class="control-button"
            :class="{ active: cardTemplate === 'note' }"
            @click="uiStore.setCardTemplate('note')"
          >
            小红书笔记
          </button>
          <button
            class="control-button"
            :class="{ active: cardRatio === '3-4' }"
            @click="uiStore.setCardRatio('3-4')"
          >
            3:4
          </button>
          <button
            class="control-button"
            :class="{ active: cardRatio === '4-5' }"
            @click="uiStore.setCardRatio('4-5')"
          >
            4:5
          </button>
        </div>

        <div v-if="pages[activeIndex]" class="card-scale-shell" :style="cardShellStyle">
          <article
            ref="activeCardRef"
            class="xiaohongshu-card"
            :class="[
              cardTemplate === 'clean' ? 'clean-template' : 'note-template',
              cardRatio === '3-4' ? 'ratio-3-4' : 'ratio-4-5',
              themeClass,
            ]"
            :style="scaledCardStyle"
          >
            <header class="card-page-header">
              <span>Longform Card</span>
              <span>{{ String(activeIndex + 1).padStart(2, '0') }}</span>
            </header>

            <section class="card-content" v-html="pages[activeIndex].html" />

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
  </div>
</template>

<style lang="less" scoped>
.card-mode-preview {
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
  min-height: 40px;
}

.control-button {
  min-height: 32px;
  border-radius: 6px;
  padding: 0 10px;
  color: hsl(var(--muted-foreground));
  transition: background 0.16s ease, color 0.16s ease;

  &.active,
  &:hover {
    background: hsl(var(--accent));
    color: hsl(var(--accent-foreground));
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
  padding: 26px 28px 20px;
}

.note-template {
  display: flex;
  flex-direction: column;
  border-color: color-mix(in srgb, var(--card-primary, #b76e79) 28%, #f4c7d3);
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.88), rgb(255 250 252 / 0.98)),
    radial-gradient(circle at 85% 10%, color-mix(in srgb, var(--card-primary, #b76e79) 24%, #ffdce6) 0, transparent 32%),
    #fff7fa;
  padding: 26px 26px 20px;
  box-shadow: 0 24px 70px color-mix(in srgb, var(--card-primary, #b76e79) 22%, transparent);
}

.note-template .card-page-header,
.note-template .card-page-footer {
  color: var(--card-primary, #ba6a83);
}

.note-template .card-page-footer {
  border-top-color: color-mix(in srgb, var(--card-primary, #ba6a83) 20%, #f3d6de);
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
  padding-bottom: 18px;
}

.card-page-footer {
  padding-top: 16px;
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
    font-size: calc(var(--card-font-size, 16px) * 1.9);
    font-weight: 800;
    line-height: 1.16;
  }

  h2 {
    margin: 0 0 14px;
    font-size: calc(var(--card-font-size, 16px) * 1.38);
    font-weight: 760;
    line-height: 1.22;
  }

  h3 {
    margin: 0 0 10px;
    font-size: calc(var(--card-font-size, 16px) * 1.08);
    font-weight: 720;
    line-height: 1.3;
  }

  p {
    margin: 0 0 13px;
    color: #343832;
    font-size: var(--card-font-size, 16px);
    line-height: 1.72;
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
    max-height: 190px;
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
    max-height: 160px;
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
    color: #2b2527;
    font-size: calc(var(--card-font-size, 16px) * 2);
  }

  h2 {
    display: inline-block;
    border-radius: 999px;
    background: color-mix(in srgb, var(--card-primary, #943d5a) 14%, white);
    padding: 7px 13px;
    color: var(--card-primary, #943d5a);
    font-size: calc(var(--card-font-size, 16px) * 1.25);
  }

  h3 {
    color: var(--card-primary, #943d5a);
  }

  p {
    color: #3d3437;
    font-size: var(--card-font-size, 16px);
  }

  strong {
    border-radius: 5px;
    background: linear-gradient(transparent 58%, color-mix(in srgb, var(--card-primary, #ffe071) 24%, #ffe071) 58%);
    color: #1f1d1c;
  }

  blockquote {
    border-left: 0;
    border-radius: 8px;
    background: color-mix(in srgb, var(--card-primary, #8c3551) 10%, #fff0f4);
    padding: 13px 15px;
  }

  blockquote p {
    color: color-mix(in srgb, var(--card-primary, #8c3551) 75%, #2b2527);
  }

  ul,
  ol {
    padding-left: 18px;
  }

  li::marker {
    color: var(--card-primary, #d85e83);
  }

  code {
    background: color-mix(in srgb, var(--card-primary, #943d5a) 12%, #ffe8ef);
    color: var(--card-primary, #943d5a);
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
</style>
