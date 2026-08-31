import { computed, ref } from 'vue'

export type AppLocale = 'zh-Hans' | 'en'

const detected = (() => {
  try { return String(uni.getLocale?.() || 'zh-Hans').toLowerCase().startsWith('en') ? 'en' : 'zh-Hans' }
  catch { return 'zh-Hans' }
})() as AppLocale

const locale = ref<AppLocale>(detected)

const messages = {
  'zh-Hans': {
    expeditions: '远征', myJourney: '旅程', atlas: '图鉴', worldTab: '世界', profileTab: '我的',
  },
  en: {
    expeditions: 'EXPEDITIONS', myJourney: 'MY JOURNEY', atlas: 'TRAVEL ATLAS', worldTab: 'WORLD', profileTab: 'JOURNEY',
  },
} as const

export function useAppLocale() {
  const isChinese = computed(() => locale.value === 'zh-Hans')
  const t = (key: keyof typeof messages['zh-Hans']) => messages[locale.value][key]
  return { locale, isChinese, localeClass: computed(() => isChinese.value ? 'locale-zh' : 'locale-en'), t }
}

