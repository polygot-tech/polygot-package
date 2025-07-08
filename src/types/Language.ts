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
  | "pa"  // Punjabi
  | "mr"  // Marathi
  | "te"  // Telugu
  | "ta"  // Tamil
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
    "id", "de", "ja", "sw", "pa", "mr", "te", "ta", "vi", "tr",
    "ko", "fa", "it", "pl", "nl"
  ];
  return typeof code === 'string' && validCodes.includes(code as LanguageCodes);
};