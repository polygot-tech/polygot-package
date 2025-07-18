import React, {
  useState,
  useEffect,
  createContext,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { fetchTranslations } from '../services/translations';
import { isValidLanguageCode, LanguageCodes } from '../types/Language';

interface PolygotProviderProps {
  children: ReactNode;
  sourceLanguage?: LanguageCodes;
  appId: string;
}

export interface PolygotContextType {
  t: (text: string) => string;
  setLanguage: (language: LanguageCodes) => void;
  language: LanguageCodes;
  isLoading: boolean; // Keep for global indicators if needed (e.g., a navbar spinner)
  error: string | null;
  inflightRequests: Set<string>; // <-- New: Track in-flight strings
}

export const PolygotContext = createContext<PolygotContextType | null>(null);

export const PolygotProvider: React.FC<PolygotProviderProps> = ({
  children,
  sourceLanguage = 'en',
  appId,
}) => {
  if (!isValidLanguageCode(sourceLanguage)) {
    throw new Error(`Invalid sourceLanguage: "${sourceLanguage}"`);
  }

  const [targetLanguage, setTargetLanguageState] = useState<LanguageCodes>(sourceLanguage);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inflightRequests, setInflightRequests] = useState<Set<string>>(new Set()); // <-- New state

  const pendingTranslations = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    setTranslations({});
    pendingTranslations.current.clear();
    setInflightRequests(new Set());
  }, [targetLanguage]);

  const processPendingTranslations = useCallback(async () => {
    if (pendingTranslations.current.size === 0) return;

    setIsLoading(true);
    setError(null);

    const stringsToTranslate = Array.from(pendingTranslations.current);
    pendingTranslations.current.clear();

    setInflightRequests((prev) => new Set([...(prev as any), ...stringsToTranslate]));

    try {
      const newTranslations = await fetchTranslations(
        stringsToTranslate,
        sourceLanguage,
        targetLanguage,
        appId
      );

      const newTranslationsMap = stringsToTranslate.reduce((acc, original, index) => {
        acc[original] = newTranslations[index];
        return acc;
      }, {} as Record<string, string>);

      setTranslations((prev) => ({ ...prev, ...newTranslationsMap }));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
      setInflightRequests((prev) => {
        const next = new Set(prev);
        stringsToTranslate.forEach((key) => next.delete(key));
        return next;
      });
    }
  }, [appId, sourceLanguage, targetLanguage]);

  const t = useCallback((text: string): string => {
    if (!text || targetLanguage === sourceLanguage) return text;

    if (translations[text] || inflightRequests.has(text)) {
      return translations[text] || text;
    }

    if (typeof text === 'string' && text.trim() !== '') {
      pendingTranslations.current.add(text);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(processPendingTranslations, 500);
    }

    return text;
  }, [targetLanguage, sourceLanguage, translations, processPendingTranslations, inflightRequests]);

  const setLanguage = useCallback((lang: LanguageCodes) => {
    if (!isValidLanguageCode(lang)) {
      throw new Error(`Invalid language code passed to setLanguage: "${lang}"`);
    }
    setTargetLanguageState(lang);
  }, []);

  const value: PolygotContextType = {
    t,
    setLanguage,
    language: targetLanguage,
    isLoading,
    error,
    inflightRequests, // <-- Expose in-flight state
  };

  // The provider now simply renders its children, handing down state via context.
  return (
    <PolygotContext.Provider value={value}>
      {children}
    </PolygotContext.Provider>
  );
};