<script setup lang="ts">
/**
 * [INPUT]: 依赖主题配置、长图文模板注册表、样式控件与 UI 状态 Store
 * [OUTPUT]: 对外提供公众号与长图文共用的右侧样式配置面板
 * [POS]: editor 组件域的视觉配置入口，模板选项从 cards 注册表自动扩展并写回全局状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type {
  HeadingLevel,
  HeadingStyleType,
  themeMap,
} from '@md/shared/configs'
import type { Format } from 'vue-pick-colors'
import { X } from '@lucide/vue'
import PickColors from 'vue-pick-colors'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useEditorRefresh } from '@/composables/useEditorRefresh'
import { useLocalizedStyleOptions } from '@/composables/useLocalizedStyleOptions'
import { cardTemplates } from '@/lib/cards/card-templates'
import { useConfirmStore } from '@/stores/confirm'
import { useCssEditorStore } from '@/stores/cssEditor'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'

const confirmStore = useConfirmStore()
const cssEditorStore = useCssEditorStore()
const uiStore = useUIStore()
const themeStore = useThemeStore()
const { t } = useI18n()
const localizedStyleOptions = useLocalizedStyleOptions()
const cardTemplateOptions = Object.values(cardTemplates)
const {
  theme,
  fontFamily,
  fontSize,
  primaryColor,
  codeBlockTheme,
  legend,
  isMacCodeBlock,
  isShowLineNumber,
  isCiteStatus,
  isUseIndent,
  isUseJustify,
} = storeToRefs(themeStore)

const { scheduleEditorRefresh, editorRefresh } = useEditorRefresh()

// 标题样式选择器状态
const selectedHeadingLevel = ref<HeadingLevel>(`h2`)
const selectedHeadingStyle = computed({
  get: () => themeStore.getHeadingStyle(selectedHeadingLevel.value),
  set: (val: HeadingStyleType) => {
    themeStore.setHeadingStyle(selectedHeadingLevel.value, val)
    if (val === `custom`) {
      // 打开 CSS 编辑器并滚动到对应标题区域
      uiStore.isShowCssEditor = true
      // 等待 CSS 编辑器打开后再滚动
      nextTick(() => {
        setTimeout(() => {
          cssEditorStore.scrollToHeading(selectedHeadingLevel.value)
        }, 100)
      })
    }
    // 无论选择预设还是自定义，都立即应用主题，确保标题样式及时恢复/更新
    themeStore.applyCurrentTheme()
    scheduleEditorRefresh()
  },
})

const { isMobile, isOpenRightSlider, isDark, previewMode, cardTemplate } = storeToRefs(uiStore)

// Theme change handlers
function themeChanged(newTheme: keyof typeof themeMap) {
  themeStore.theme = newTheme
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function fontChanged(fonts: string) {
  themeStore.fontFamily = fonts
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function sizeChanged(size: string) {
  themeStore.fontSize = size
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function colorChanged(newColor: string) {
  themeStore.primaryColor = newColor
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function codeBlockThemeChanged(newTheme: unknown) {
  if (typeof newTheme !== 'string')
    return
  themeStore.codeBlockTheme = newTheme
  scheduleEditorRefresh()
}

function legendChanged(newVal: string) {
  themeStore.legend = newVal
  scheduleEditorRefresh()
}

function macCodeBlockChanged() {
  themeStore.isMacCodeBlock = !themeStore.isMacCodeBlock
  scheduleEditorRefresh()
}

function showLineNumberChanged() {
  themeStore.isShowLineNumber = !themeStore.isShowLineNumber
  scheduleEditorRefresh()
}

function citeStatusChanged() {
  themeStore.isCiteStatus = !themeStore.isCiteStatus
  scheduleEditorRefresh()
}

function useIndentChanged() {
  themeStore.isUseIndent = !themeStore.isUseIndent
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function useJustifyChanged() {
  themeStore.isUseJustify = !themeStore.isUseJustify
  // 使用新主题系统
  themeStore.applyCurrentTheme()
  scheduleEditorRefresh()
}

function setMacCodeBlock(checked: boolean) {
  if (checked !== isMacCodeBlock.value)
    macCodeBlockChanged()
}

function setShowLineNumber(checked: boolean) {
  if (checked !== isShowLineNumber.value)
    showLineNumberChanged()
}

function setCiteStatus(checked: boolean) {
  if (checked !== isCiteStatus.value)
    citeStatusChanged()
}

function setUseIndent(checked: boolean) {
  if (checked !== isUseIndent.value)
    useIndentChanged()
}

function setUseJustify(checked: boolean) {
  if (checked !== isUseJustify.value)
    useJustifyChanged()
}

function resetStyleConfirm() {
  confirmStore.confirm({
    title: t(`confirm.tip`),
    description: t(`confirm.resetStyleDescription`),
    onConfirm: () => {
      themeStore.resetStyle()
      cssEditorStore.resetCssConfig()
      themeStore.applyCurrentTheme()
      editorRefresh()
      toast.success(t(`toast.styleReset`))
    },
  })
}

// 控制是否启用动画
const enableAnimation = ref(false)

// 监听 RightSlider 开关状态变化
watch(isOpenRightSlider, () => {
  if (isMobile.value) {
    // 在移动端，用户操作时启用动画
    enableAnimation.value = true
  }
})

// 监听设备类型变化，重置动画状态
watch(isMobile, () => {
  enableAnimation.value = false
})

const pickColorsContainer = useTemplateRef<HTMLElement | undefined>(`pickColorsContainer`)
const format = ref<Format>(`rgb`)
const formatOptions = ref<Format[]>([`rgb`, `hex`, `hsl`, `hsv`])
</script>

<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="isMobile && isOpenRightSlider"
    class="fixed inset-0 bg-black/50 z-40"
    @click="isOpenRightSlider = false"
  />

  <div
    class="h-full overflow-hidden"
    :class="{
      'fixed top-0 right-0 w-full h-full z-55 bg-background border-l shadow-lg mobile-right-drawer': isMobile,
      'animate': isMobile && enableAnimation,
    }"
    :style="isMobile ? { transform: isOpenRightSlider ? 'translateX(0)' : 'translateX(100%)' } : undefined"
  >
    <div
      class="h-full space-y-4 overflow-auto p-4"
      :class="{ 'pt-0': isMobile }"
    >
      <!-- 移动端标题栏 -->
      <div v-if="isMobile" class="sticky top-0 z-10 -mx-4 mb-4 border-b bg-background px-4 pb-3 pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <div aria-hidden="true" class="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            {{ t('rightSlider.title') }}
          </h2>
          <Button variant="ghost" size="sm" @click="isOpenRightSlider = false">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div v-if="previewMode === 'cards'" class="space-y-2">
        <h2 class="text-sm font-medium">
          长图文样式
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="option in cardTemplateOptions"
            :key="option.id"
            type="button"
            class="card-template-option"
            :class="{ active: cardTemplate === option.id }"
            :aria-pressed="cardTemplate === option.id"
            :title="option.description"
            @click="cardTemplate = option.id"
          >
            <span
              class="card-template-swatch"
              :style="{
                backgroundColor: option.previewBackground,
                color: option.previewForeground,
              }"
            >
              <span class="card-template-swatch-title" />
              <span class="card-template-swatch-line short" />
              <span class="card-template-swatch-line" />
            </span>
            <span class="min-w-0 text-left">
              <span class="block truncate text-xs font-medium">{{ option.name }}</span>
              <span class="mt-0.5 block truncate text-[10px] text-muted-foreground">{{ option.description }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.theme') }}
        </h2>
        <div class="grid grid-cols-3 gap-2">
          <Button
            v-for="{ label, value } in localizedStyleOptions.themeOptions" :key="value" class="h-auto w-full px-1.5 py-2 text-xs whitespace-nowrap" variant="outline" :class="{
              'border-primary ring-1 ring-primary/20 border-2': theme === value,
            }" @click="themeChanged(value)"
          >
            {{ label }}
          </Button>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.font') }}
        </h2>
        <div class="grid grid-cols-3 gap-2">
          <Button
            v-for="{ label, value } in localizedStyleOptions.fontFamilyOptions" :key="value" variant="outline" class="h-auto w-full px-1.5 py-2 text-xs whitespace-nowrap"
            :class="{ 'border-primary ring-1 ring-primary/20 border-2': fontFamily === value }" @click="fontChanged(value)"
          >
            {{ label }}
          </Button>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.fontSize') }}
        </h2>
        <div class="grid grid-cols-5 gap-1.5">
          <Button
            v-for="{ label, value, desc } in localizedStyleOptions.fontSizeOptions" :key="value" variant="outline" class="h-auto w-full px-1 py-2 text-xs whitespace-nowrap" :title="desc" :class="{
              'border-primary ring-1 ring-primary/20 border-2': fontSize === value,
            }" @click="sizeChanged(value)"
          >
            {{ label }}
          </Button>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.primaryColor') }}
        </h2>
        <div class="grid grid-cols-3 gap-2">
          <Button
            v-for="{ label, value } in localizedStyleOptions.colorOptions" :key="value" class="h-auto w-full px-1.5 py-2 text-xs whitespace-nowrap" variant="outline" :class="{
              'border-primary ring-1 ring-primary/20 border-2': primaryColor === value,
            }" @click="colorChanged(value)"
          >
            <span
              class="mr-1.5 inline-block size-3 shrink-0 rounded-full" :style="{
                background: value,
              }"
            />
            {{ label }}
          </Button>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.customPrimaryColor') }}
        </h2>
        <div ref="pickColorsContainer">
          <PickColors
            v-if="pickColorsContainer" v-model:value="primaryColor" show-alpha :format="format"
            :format-options="formatOptions" :theme="isDark ? 'dark' : 'light'"
            :popup-container="pickColorsContainer" @change="colorChanged"
          />
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('rightSlider.headingStyle') }}
        </h2>
        <div class="flex gap-2">
          <Select v-model="selectedHeadingLevel">
            <SelectTrigger class="w-[120px]">
              <SelectValue :placeholder="t('rightSlider.selectHeading')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="{ label, value } in localizedStyleOptions.headingLevelOptions" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select v-model="selectedHeadingStyle">
            <SelectTrigger class="flex-1">
              <SelectValue :placeholder="t('rightSlider.selectStyle')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="{ label, value } in localizedStyleOptions.headingStyleOptions" :key="value" :value="value">
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.codeBlockTheme') }}
        </h2>
        <Select v-model="codeBlockTheme" @update:model-value="codeBlockThemeChanged">
          <SelectTrigger>
            <SelectValue :placeholder="t('rightSlider.selectCodeBlockTheme')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="{ label, value } in localizedStyleOptions.codeBlockThemeOptions" :key="label" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('menu.legendFormat') }}
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <Button
            v-for="{ label, value } in localizedStyleOptions.legendOptions" :key="value" class="h-auto w-full px-1.5 py-2 text-xs whitespace-nowrap" variant="outline" :class="{
              'border-primary ring-1 ring-primary/20 border-2': legend === value,
            }" @click="legendChanged(value)"
          >
            {{ label }}
          </Button>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="mac-code-block" class="min-w-0 shrink text-xs leading-snug sm:text-sm">{{ t('menu.macCodeBlock') }}</Label>
        <Switch id="mac-code-block" class="shrink-0" :model-value="isMacCodeBlock" @update:model-value="setMacCodeBlock" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="show-line-number" class="min-w-0 shrink text-xs leading-snug sm:text-sm">{{ t('rightSlider.codeBlockLineNumber') }}</Label>
        <Switch id="show-line-number" class="shrink-0" :model-value="isShowLineNumber" @update:model-value="setShowLineNumber" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="cite-status" class="min-w-0 shrink text-xs leading-snug sm:text-sm">{{ t('rightSlider.citeStatus') }}</Label>
        <Switch id="cite-status" class="shrink-0" :model-value="isCiteStatus" @update:model-value="setCiteStatus" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="use-indent" class="min-w-0 shrink text-xs leading-snug sm:text-sm">{{ t('rightSlider.paragraphIndent') }}</Label>
        <Switch id="use-indent" class="shrink-0" :model-value="isUseIndent" @update:model-value="setUseIndent" />
      </div>
      <div class="flex items-center justify-between gap-3">
        <Label for="use-justify" class="min-w-0 shrink text-xs leading-snug sm:text-sm">{{ t('rightSlider.paragraphJustify') }}</Label>
        <Switch id="use-justify" class="shrink-0" :model-value="isUseJustify" @update:model-value="setUseJustify" />
      </div>
      <div class="space-y-2">
        <h2 class="text-sm font-medium">
          {{ t('rightSlider.styleConfig') }}
        </h2>
        <Button variant="destructive" @click="resetStyleConfirm">
          {{ t('menu.reset') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-template-option {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  padding: 7px;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.card-template-option:hover,
.card-template-option.active {
  border-color: hsl(var(--primary));
}

.card-template-option.active {
  border-width: 2px;
  padding: 6px;
  box-shadow: 0 0 0 1px hsl(var(--primary) / 20%);
}

.card-template-swatch {
  display: flex;
  width: 34px;
  height: 44px;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
  border: 1px solid rgb(0 0 0 / 8%);
  border-radius: 3px;
  padding: 6px;
  box-shadow: inset 0 0 14px rgb(255 255 255 / 8%);
}

.card-template-swatch-title,
.card-template-swatch-line {
  display: block;
  height: 2px;
  border-radius: 99px;
  background: currentcolor;
  opacity: 0.75;
}

.card-template-swatch-title {
  height: 4px;
  margin-bottom: 2px;
}

.card-template-swatch-line.short {
  width: 70%;
}

/* 移动端右侧栏动画 - 只有添加了 animate 类才启用 */
.mobile-right-drawer.animate {
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
