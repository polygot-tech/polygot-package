import React, {
  useState,
  useEffect,
  createContext,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { fetchTranslations } from '../services/translations';
import { 
  TranslationOptions, 
  LanguageChangeOptions, 
  SupportedLanguage,
  TranslationTone,
  Region,
  isValidLanguage,
  isValidRegionForLanguage,
  getValidRegionsForLanguage,
  TRANSLATION_TONES,
  LANGUAGE_REGION_MAP
} from '../types/Language';

interface PolygotProviderProps {
  children: ReactNode;
  sourceLanguage?: SupportedLanguage;
  appId: string;
  defaultLanguage?: SupportedLanguage;
  defaultTone?: TranslationTone;
  defaultRegion?: Region;
  defaultContext?: string;
  batchSize?: number;
  debounceMs?: number;
}

interface TranslationMetadata {
  detectedLanguage?: string;
  tone: string;
  region?: string;
  processingTime: number;
  cached: boolean;
  autoDetected: boolean;
  timestamp: string;
}

interface TranslationStats {
  totalTranslations: number;
  cacheHits: number;
  autoDetectedCount: number;
  averageProcessingTime: number;
}

export interface PolygotContextType {
  // Core translation function
  t: (text: string, options?: TranslationOptions) => string;
  
  // Enhanced language setter with all options
  setLanguage: <T extends SupportedLanguage>(options: LanguageChangeOptions<T>) => void;
  
  // Current state
  language: SupportedLanguage;
  sourceLanguage?: SupportedLanguage;
  currentOptions: {
    tone: TranslationTone;
    region?: Region;
    context?: string;
  };
  
  // Status
  isLoading: boolean;
  error: string | null;
  inflightRequests: Set<string>;
  
  // Utilities
  clearTranslations: () => void;
  getTranslationMetadata: (text: string) => TranslationMetadata | null;
  
  // Statistics
  stats: TranslationStats;
  
  // Helper functions for TypeScript intellisense
  getSupportedLanguages: () => SupportedLanguage[];
  getSupportedTones: () => TranslationTone[];
  getValidRegionsForLanguage: <T extends SupportedLanguage>(language: T) => readonly Region[];
  
  // Validation helpers
  isValidLanguage: (language: string) => language is SupportedLanguage;
  isValidTone: (tone: string) => tone is TranslationTone;
  isValidRegionForLanguage: <T extends SupportedLanguage>(language: T, region: string) => boolean;
}

export const PolygotContext = createContext<PolygotContextType | null>(null);

export const PolygotProvider: React.FC<PolygotProviderProps> = ({
  children,
  sourceLanguage,
  appId,
  defaultLanguage = 'English',
  defaultTone = 'neutral',
  defaultRegion,
  defaultContext,
  batchSize = 50,
  debounceMs = 500,
}) => {
  // Validate initial props
  if (sourceLanguage && !isValidLanguage(sourceLanguage)) {
    throw new Error(`Invalid sourceLanguage: "${sourceLanguage}". Must be one of: ${Object.keys(LANGUAGE_REGION_MAP).join(', ')}`);
  }
  
  if (!isValidLanguage(defaultLanguage)) {
    throw new Error(`Invalid defaultLanguage: "${defaultLanguage}". Must be one of: ${Object.keys(LANGUAGE_REGION_MAP).join(', ')}`);
  }

  // State management
  const [targetLanguage, setTargetLanguageState] = useState<SupportedLanguage>(defaultLanguage);
  const [currentTone, setCurrentTone] = useState<TranslationTone>(defaultTone);
  const [currentRegion, setCurrentRegion] = useState<Region | undefined>(defaultRegion);
  const [currentContext, setCurrentContext] = useState<string | undefined>(defaultContext);
  
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translationMetadata, setTranslationMetadata] = useState<Record<string, TranslationMetadata>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [inflightRequests, setInflightRequests] = useState<Set<string>>(new Set());
  
  const [stats, setStats] = useState<TranslationStats>({
    totalTranslations: 0,
    cacheHits: 0,
    autoDetectedCount: 0,
    averageProcessingTime: 0,
  });

  // Refs for managing translation queue
  const pendingTranslations = useRef<Map<string, TranslationOptions>>(new Map());
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  // Clear everything when target or source language changes
  useEffect(() => {
    setTranslations({});
    setTranslationMetadata({});
    pendingTranslations.current.clear();
    setInflightRequests(new Set());
    setError(null);
    
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    
    isProcessingRef.current = false;
  }, [targetLanguage, sourceLanguage]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // Cache key generator
  const createCacheKey = useCallback((text: string, options?: TranslationOptions) => {
    const resolvedOptions = {
      tone: options?.tone || currentTone,
      region: options?.region || currentRegion || '',
      context: options?.context || currentContext || ''
    };
    return `${text}|||${JSON.stringify(resolvedOptions)}`;
  }, [currentTone, currentRegion, currentContext]);

  // Statistics updater
  const updateStats = useCallback((newMetadata: TranslationMetadata[], translationsCount: number) => {
    if (!mountedRef.current || newMetadata.length === 0) return;
    
    const avgProcessingTime = newMetadata.reduce((sum, meta) => sum + meta.processingTime, 0) / newMetadata.length;
    const cacheHitCount = newMetadata.filter(meta => meta.cached).length;
    const autoDetectedCount = newMetadata.filter(meta => meta.autoDetected).length;

    setStats(prev => ({
      totalTranslations: prev.totalTranslations + translationsCount,
      cacheHits: prev.cacheHits + cacheHitCount,
      autoDetectedCount: prev.autoDetectedCount + autoDetectedCount,
      averageProcessingTime: prev.totalTranslations === 0 
        ? avgProcessingTime
        : (prev.averageProcessingTime * prev.totalTranslations + avgProcessingTime * translationsCount) / (prev.totalTranslations + translationsCount)
    }));
  }, []);

  // Process pending translations
  const processPendingTranslations = useCallback(async () => {
    if (isProcessingRef.current || pendingTranslations.current.size === 0 || !mountedRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setIsLoading(true);
    setError(null);

    let allPending: [string, TranslationOptions][] = [];
    let allStrings: string[] = [];

    try {
      allPending = Array.from(pendingTranslations.current.entries());
      allStrings = allPending.map(([text]) => text);
      pendingTranslations.current.clear();
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      // Group by options for batching
      const optionGroups = new Map<string, { strings: string[], options: TranslationOptions }>();
      
      allPending.forEach(([text, options]) => {
        const optionKey = JSON.stringify({
          tone: options.tone || currentTone,
          region: options.region || currentRegion || '',
          context: options.context || currentContext || ''
        });
        
        if (!optionGroups.has(optionKey)) {
          optionGroups.set(optionKey, { strings: [], options });
        }
        optionGroups.get(optionKey)!.strings.push(text);
      });

      // Create batches
      const batches: Array<{ strings: string[], options: TranslationOptions }> = [];
      optionGroups.forEach(group => {
        for (let i = 0; i < group.strings.length; i += batchSize) {
          batches.push({
            strings: group.strings.slice(i, i + batchSize),
            options: group.options
          });
        }
      });

      setInflightRequests(prev => {
        let s = new Set(prev)
        allPending.forEach(([text, options]) => s.add(createCacheKey(text, options)));
        return s});

      const newTranslations: Record<string, string> = {};
      const newMetadata: TranslationMetadata[] = [];

      // Process batches
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        if (!mountedRef.current) break;

        try {
          const result = await fetchTranslations(
            batch.strings,
            targetLanguage,
            appId,
            sourceLanguage,
            batch.options
          );

          let translatedStrings: string[];
          if (typeof result === 'string') {
            translatedStrings = [result];
          } else if (Array.isArray(result)) {
            translatedStrings = result;
          } else if (typeof result === 'object') {
            translatedStrings = Object.values(result);
          } else {
            throw new Error('Invalid response format');
          }

          batch.strings.forEach((originalText, index) => {
            if (!mountedRef.current) return;
            
            const translatedText = translatedStrings[index] || originalText;
            const cacheKey = createCacheKey(originalText, batch.options);
            
            newTranslations[cacheKey] = translatedText;
            
            const metadata: TranslationMetadata = {
              detectedLanguage: sourceLanguage ? undefined : 'Auto-detected',
              tone: batch.options.tone || currentTone,
              region: batch.options.region || currentRegion,
              processingTime: 150,
              cached: false,
              autoDetected: !sourceLanguage,
              timestamp: new Date().toISOString()
            };
            
            newMetadata.push(metadata);
            setTranslationMetadata(prev => ({ ...prev, [originalText]: metadata }));
          });

        } catch (batchError) {
          console.error(`Batch ${i + 1} failed:`, batchError);
          
          batch.strings.forEach(originalText => {
            if (!mountedRef.current) return;
            
            const cacheKey = createCacheKey(originalText, batch.options);
            newTranslations[cacheKey] = originalText;
            
            const fallbackMetadata: TranslationMetadata = {
              detectedLanguage: undefined,
              tone: batch.options.tone || currentTone,
              region: batch.options.region || currentRegion,
              processingTime: 0,
              cached: false,
              autoDetected: false,
              timestamp: new Date().toISOString()
            };
            
            newMetadata.push(fallbackMetadata);
            setTranslationMetadata(prev => ({ ...prev, [originalText]: fallbackMetadata }));
          });
        }

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (mountedRef.current) {
        setTranslations(prev => ({ ...prev, ...newTranslations }));
        updateStats(newMetadata, allStrings.length);
      }

    } catch (error) {
      console.error('Translation processing failed:', error);
      
      if (mountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        setError(errorMessage);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        
        setInflightRequests(prev => {
          const next = new Set(prev);
          allStrings.forEach(text => next.delete(text));
          return next;
        });
      }
      
      isProcessingRef.current = false;
    }
  }, [
    appId,
    sourceLanguage,
    targetLanguage,
    currentTone,
    currentRegion,
    currentContext,
    batchSize,
    createCacheKey,
    updateStats
  ]);

  // Translation function
  const t = useCallback((text: string, options?: TranslationOptions): string => {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return text;
  }

  const resolvedOptions: TranslationOptions = {
    tone: options?.tone || currentTone,
    region: options?.region || currentRegion,
    context: options?.context || currentContext
  };

  // Allow translation if region/tone/context matter!
  const noRegion = !resolvedOptions.region;
  const defaultTone = !resolvedOptions.tone || resolvedOptions.tone === 'neutral';
  const noContext = !resolvedOptions.context;

  if (
    sourceLanguage &&
    targetLanguage === sourceLanguage &&
    noRegion &&
    defaultTone &&
    noContext
  ) {
    return text; // Only skip if all options are default/empty
  }

  const cacheKey = createCacheKey(text, options);

  if (translations[cacheKey]) {
    return translations[cacheKey];
  }

  if (inflightRequests.has(cacheKey)) {
    return text;
  }

  if (isProcessingRef.current || !mountedRef.current) {
    return text;
  }

  if (!pendingTranslations.current.has(text)) {
    pendingTranslations.current.set(text, resolvedOptions);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (mountedRef.current) {
        processPendingTranslations();
      }
    }, debounceMs);
  }

  return text;
}, [
  sourceLanguage,
  targetLanguage,
  translations,
  inflightRequests,
  createCacheKey,
  currentTone,
  currentRegion,
  currentContext,
  debounceMs,
  processPendingTranslations
]);


  // Enhanced language setter with type safety
  const setLanguage = useCallback(<T extends SupportedLanguage>(options: LanguageChangeOptions<T>) => {
    const { language, tone, region, context } = options;
    
    // Validate language
    if (!isValidLanguage(language)) {
      throw new Error(
        `Invalid language: "${language}". Supported languages: ${Object.keys(LANGUAGE_REGION_MAP).join(', ')}`
      );
    }
    
    // Validate region for language if provided
    if (region && !isValidRegionForLanguage(language, region)) {
      const validRegions = getValidRegionsForLanguage(language);
      throw new Error(
        `Invalid region "${region}" for language "${language}". Valid regions: ${validRegions.join(', ')}`
      );
    }
    
    // Validate tone if provided
    if (tone && !TRANSLATION_TONES.includes(tone)) {
      throw new Error(
        `Invalid tone: "${tone}". Supported tones: ${TRANSLATION_TONES.join(', ')}`
      );
    }

    console.log(`Language changing to: ${language}`, { tone, region, context });
    
    // Update all relevant state
    setTargetLanguageState(language);
    
    if (tone !== undefined) {
      setCurrentTone(tone);
    }
    
    if (region !== undefined) {
      setCurrentRegion(region);
    }
    
    if (context !== undefined) {
      setCurrentContext(context);
    }
  }, []);

  // Utility functions
  const clearTranslations = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    
    setTranslations({});
    setTranslationMetadata({});
    pendingTranslations.current.clear();
    setInflightRequests(new Set());
    setError(null);
    isProcessingRef.current = false;
    setStats({
      totalTranslations: 0,
      cacheHits: 0,
      autoDetectedCount: 0,
      averageProcessingTime: 0,
    });
  }, []);

  const getTranslationMetadata = useCallback((text: string): TranslationMetadata | null => {
    return translationMetadata[text] || null;
  }, [translationMetadata]);

  // Helper functions for TypeScript intellisense
  const getSupportedLanguages = useCallback((): SupportedLanguage[] => {
    return Object.keys(LANGUAGE_REGION_MAP) as SupportedLanguage[];
  }, []);

  const getSupportedTones = useCallback((): TranslationTone[] => {
    return [...TRANSLATION_TONES];
  }, []);

  const getValidRegionsForLanguageHelper = useCallback(<T extends SupportedLanguage>(language: T) => {
    return getValidRegionsForLanguage(language);
  }, []);

  // Memoized context value
  const contextValue = useMemo((): PolygotContextType => ({
    t,
    setLanguage,
    language: targetLanguage,
    sourceLanguage,
    currentOptions: {
      tone: currentTone,
      region: currentRegion,
      context: currentContext,
    },
    isLoading,
    error,
    inflightRequests,
    clearTranslations,
    getTranslationMetadata,
    stats,
    getSupportedLanguages,
    getSupportedTones,
    getValidRegionsForLanguage: getValidRegionsForLanguageHelper,
    isValidLanguage,
    isValidTone: (tone: string): tone is TranslationTone => TRANSLATION_TONES.includes(tone as TranslationTone),
    isValidRegionForLanguage,
  }), [
    t,
    setLanguage,
    targetLanguage,
    sourceLanguage,
    currentTone,
    currentRegion,
    currentContext,
    isLoading,
    error,
    inflightRequests,
    clearTranslations,
    getTranslationMetadata,
    stats,
    getSupportedLanguages,
    getSupportedTones,
    getValidRegionsForLanguageHelper,
  ]);

  return (
    <PolygotContext.Provider value={contextValue}>
      {children}
    </PolygotContext.Provider>
  );
};

// Single hook export
export const usePolygot = () => {
  const context = React.useContext(PolygotContext);
  if (!context) {
    throw new Error('usePolygot must be used within a PolygotProvider');
  }
  return context;
};
