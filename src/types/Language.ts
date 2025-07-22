export type LanguageCodes =
  | "en"  // English
  | "zh"  // Chinese (Mandarin)
  | "hi"  // Hindi
  | "es"  // Spanish
  | "fr"  // French
  | "ar"  // Arabic
  | "bn"  // Bengali
  | "ru"  // Russian
  | "pt"  // Portuguese
  | "ur"  // Urdu
  | "id"  // Indonesian
  | "de"  // German
  | "ja"  // Japanese
  | "sw"  // Swahili
  | "vi"  // Vietnamese
  | "tr"  // Turkish
  | "ko"  // Korean
  | "fa"  // Persian (Farsi)
  | "it"  // Italian
  | "pl"  // Polish
  | "nl"; // Dutch


  export const isValidLanguageCode = (code: unknown): code is LanguageCodes => {
  const validCodes: LanguageCodes[] = [
    "en", "zh", "hi", "es", "fr", "ar", "bn", "ru", "pt", "ur",
    "id", "de", "ja", "sw", "vi", "tr",
    "ko", "fa", "it", "pl", "nl"
  ];
  return typeof code === 'string' && validCodes.includes(code as LanguageCodes);
};


// Translation tones supported by the backend
export const TRANSLATION_TONES = [
  'professional',
  'casual', 
  'formal',
  'friendly',
  'academic',
  'conversational',
  'business',
  'creative',
  'technical',
  'diplomatic',
  'neutral'
] as const;

export type TranslationTone = typeof TRANSLATION_TONES[number];

// Language to region mapping (from your backend)
export const LANGUAGE_REGION_MAP = {
  'English': ['US', 'UK', 'CA', 'AU', 'NZ', 'IE', 'ZA', 'IN', 'SG', 'MY', 'PH'],
  'Spanish': ['ES', 'MX', 'AR', 'CO', 'PE', 'VE', 'CL', 'EC', 'GT', 'CU'],
  'French': ['FR', 'CA', 'BE', 'CH', 'LU', 'MC'],
  'German': ['DE', 'AT', 'CH', 'LI', 'LU', 'BE'],
  'Portuguese': ['BR', 'PT', 'AO', 'MZ', 'GW', 'CV', 'ST', 'TL', 'MO'],
  'Chinese': ['CN', 'TW', 'HK', 'MO', 'SG', 'MY'],
  'Arabic': ['SA', 'EG', 'AE', 'MA', 'DZ', 'TN', 'LY', 'SD', 'IQ', 'SY'],
  'Hindi': ['IN', 'NP', 'FJ'],
  'Russian': ['RU', 'BY', 'KZ', 'KG', 'TJ', 'UZ', 'TM', 'MD'],
  'Japanese': ['JP'],
  'Korean': ['KR', 'KP'],
  'Italian': ['IT', 'CH', 'SM', 'VA', 'MT'],
  'Dutch': ['NL', 'BE', 'SR', 'AW', 'CW', 'SX', 'BQ'],
  'Turkish': ['TR', 'CY'],
  'Thai': ['TH'],
  'Vietnamese': ['VN'],
  'Polish': ['PL'],
  'Czech': ['CZ'],
  'Hungarian': ['HU'],
  'Swedish': ['SE', 'FI'],
  'Norwegian': ['NO'],
  'Danish': ['DK', 'FO', 'GL'],
  'Finnish': ['FI'],
  'Hebrew': ['IL']
} as const;

export type SupportedLanguage = keyof typeof LANGUAGE_REGION_MAP;
export type LanguageRegion<T extends SupportedLanguage> = typeof LANGUAGE_REGION_MAP[T][number];

// Generic region type for all languages
export type Region = typeof LANGUAGE_REGION_MAP[SupportedLanguage][number];

// Translation options interface
export interface TranslationOptions {
  tone?: TranslationTone;
  region?: Region;
  context?: string;
}

// Language change options
export interface LanguageChangeOptions<T extends SupportedLanguage = SupportedLanguage> extends TranslationOptions {
  language: T;
  region?: LanguageRegion<T>; // Region must be valid for the specific language
}

// Validation helpers
export function isValidTone(tone: string): tone is TranslationTone {
  return TRANSLATION_TONES.includes(tone as TranslationTone);
}

export function isValidLanguage(language: string): language is SupportedLanguage {
  return language in LANGUAGE_REGION_MAP;
}

export function isValidRegionForLanguage<T extends SupportedLanguage>(
  language: T, 
  region: string
): region is LanguageRegion<T> {
  return LANGUAGE_REGION_MAP[language].includes(region as never);
}

export function getValidRegionsForLanguage<T extends SupportedLanguage>(
  language: T
): readonly LanguageRegion<T>[] {
  return LANGUAGE_REGION_MAP[language];
}
