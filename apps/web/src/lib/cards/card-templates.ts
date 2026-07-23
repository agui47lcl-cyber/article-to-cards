export type CardTemplateId = 'clean' | 'note' | 'dust' | 'green'
export type CardRatio = '3-4' | '4-5'

export interface CardTemplateTokens {
  pagePaddingX: number
  pagePaddingTop: number
  pagePaddingBottom: number
  headerGap: number
  footerGap: number
  h1Scale: number
  h2Scale: number
  h3Scale: number
  titleBodyGap: number
  bodyLineHeight: number
  paragraphGap: number
  imageMaxHeight: number
  codeBlockMaxHeight: number
}

export interface CardTemplateDefinition {
  id: CardTemplateId
  name: string
  description: string
  className: string
  previewBackground: string
  previewForeground: string
  tokens: CardTemplateTokens
}

export interface CardRatioDefinition {
  id: CardRatio
  label: string
  width: number
  height: number
}

export const cardRatios: Record<CardRatio, CardRatioDefinition> = {
  '3-4': {
    id: `3-4`,
    label: `3:4`,
    width: 420,
    height: 560,
  },
  '4-5': {
    id: `4-5`,
    label: `4:5`,
    width: 420,
    height: 525,
  },
}

export const cardTemplates: Record<CardTemplateId, CardTemplateDefinition> = {
  clean: {
    id: `clean`,
    name: `清爽白底`,
    description: `稳定承载长文内容的默认知识卡片。`,
    className: `clean-template`,
    previewBackground: `#fffdf8`,
    previewForeground: `#242723`,
    tokens: {
      pagePaddingX: 28,
      pagePaddingTop: 26,
      pagePaddingBottom: 20,
      headerGap: 18,
      footerGap: 16,
      h1Scale: 1.9,
      h2Scale: 1.38,
      h3Scale: 1.08,
      titleBodyGap: 18,
      bodyLineHeight: 1.72,
      paragraphGap: 13,
      imageMaxHeight: 190,
      codeBlockMaxHeight: 160,
    },
  },
  note: {
    id: `note`,
    name: `微黄复古`,
    description: `取自 Figma 设计稿的微黄纸张感长文模板。`,
    className: `note-template`,
    previewBackground: `#f6f5e3`,
    previewForeground: `#1d2129`,
    tokens: {
      pagePaddingX: 37,
      pagePaddingTop: 23,
      pagePaddingBottom: 37,
      headerGap: 32,
      footerGap: 0,
      h1Scale: 2.5,
      h2Scale: 1.5,
      h3Scale: 1.25,
      titleBodyGap: 80 * (420 / 900),
      bodyLineHeight: 1.55,
      paragraphGap: 18,
      imageMaxHeight: 225,
      codeBlockMaxHeight: 180,
    },
  },
  dust: {
    id: `dust`,
    name: `古朴尘记`,
    description: `暗红旧纸、宋体与手绘装饰构成的复古长文模板。`,
    className: `dust-template`,
    previewBackground: `#8a1e1e`,
    previewForeground: `#ffffff`,
    tokens: {
      pagePaddingX: 80 * (420 / 900),
      pagePaddingTop: 50 * (420 / 900),
      pagePaddingBottom: 50 * (420 / 900),
      headerGap: 66 * (420 / 900),
      footerGap: 0,
      h1Scale: 2.5,
      h2Scale: 2,
      h3Scale: 1.25,
      titleBodyGap: 80 * (420 / 900),
      bodyLineHeight: 1.5,
      paragraphGap: 40 * (420 / 900),
      imageMaxHeight: 225,
      codeBlockMaxHeight: 180,
    },
  },
  green: {
    id: `green`,
    name: `绿意简记`,
    description: `鼠尾草绿纸张、宋体与手绘装饰构成的自然长文模板。`,
    className: `green-template`,
    previewBackground: `#acc594`,
    previewForeground: `#1d2129`,
    tokens: {
      pagePaddingX: 80 * (420 / 900),
      pagePaddingTop: 50 * (420 / 900),
      pagePaddingBottom: 50 * (420 / 900),
      headerGap: 66 * (420 / 900),
      footerGap: 0,
      h1Scale: 2.5,
      h2Scale: 2,
      h3Scale: 1.25,
      titleBodyGap: 80 * (420 / 900),
      bodyLineHeight: 1.5,
      paragraphGap: 40 * (420 / 900),
      imageMaxHeight: 225,
      codeBlockMaxHeight: 180,
    },
  },
}

export function getCardTemplate(id: CardTemplateId) {
  return cardTemplates[id] ?? cardTemplates.clean
}

export function getCardRatio(id: CardRatio) {
  return cardRatios[id] ?? cardRatios[`3-4`]
}

export function getCardTemplateStyleVariables(template: CardTemplateDefinition) {
  const tokens = template.tokens

  return {
    '--card-page-padding-x': `${tokens.pagePaddingX}px`,
    '--card-page-padding-top': `${tokens.pagePaddingTop}px`,
    '--card-page-padding-bottom': `${tokens.pagePaddingBottom}px`,
    '--card-header-gap': `${tokens.headerGap}px`,
    '--card-footer-gap': `${tokens.footerGap}px`,
    '--card-h1-scale': tokens.h1Scale,
    '--card-h2-scale': tokens.h2Scale,
    '--card-h3-scale': tokens.h3Scale,
    '--card-title-body-gap': `${tokens.titleBodyGap}px`,
    '--card-body-line-height': tokens.bodyLineHeight,
    '--card-paragraph-gap': `${tokens.paragraphGap}px`,
    '--card-image-max-height': `${tokens.imageMaxHeight}px`,
    '--card-code-block-max-height': `${tokens.codeBlockMaxHeight}px`,
  }
}
