// server/dictionaries.ts
import 'server-only'

const dictionaries = {
  en: () => import('./dictionaries/en.json').then((module) => module.default),
  es: () => import('./dictionaries/es.json').then((module) => module.default),
  de: () => import('./dictionaries/de.json').then((module) => module.default),
  fr: () => import('./dictionaries/fr.json').then((module) => module.default),
  it: () => import('./dictionaries/it.json').then((module) => module.default),
  pt: () => import('./dictionaries/pt.json').then((module) => module.default),
  ru: () => import('./dictionaries/ru.json').then((module) => module.default),
  ja: () => import('./dictionaries/ja.json').then((module) => module.default),
  ko: () => import('./dictionaries/ko.json').then((module) => module.default),
  zh: () => import('./dictionaries/zh.json').then((module) => module.default),
  ar: () => import('./dictionaries/ar.json').then((module) => module.default),
  hi: () => import('./dictionaries/hi.json').then((module) => module.default),
  nl: () => import('./dictionaries/nl.json').then((module) => module.default),
}

export const getDictionary = async (locale: keyof typeof dictionaries) => {
  return dictionaries[locale]?.() ?? dictionaries.en()
}

export const getContextualDictionary = async (
  locale: string, 
  context?: string
) => {
  const baseDictionary = await getDictionary(locale as keyof typeof dictionaries);
  
  if (context) {
    try {
      const contextDictionary = await import(`./dictionaries/${locale}-${context}.json`)
        .then(module => module.default)
        .catch(() => ({}));
      
      return { ...baseDictionary, ...contextDictionary };
    } catch {
      return baseDictionary;
    }
  }
  
  return baseDictionary;
}
