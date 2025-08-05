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
  // Smart URL detection configuration
  enableAutoUrlDetection?: boolean;
  supportedLanguageCodes?: string[];
  onLanguageAutoDetected?: (language: SupportedLanguage, source: 'url' | 'manual') => void;
  // SEO Configuration at Provider Level
  enableSEO?: boolean;
  seoBasePath?: string;
  autoUpdateMeta?: boolean;
  baseDomain?: string;
  defaultSEOConfig?: {
    title?: string;
    description?: string;
    keywords?: string[];
    author?: string;
    publisher?: string;
    themeColor?: string;
  };
}

interface SEOData {
  [path: string]: any;
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
  
  // Provider configuration for components to access
  providerConfig: {
    enableAutoUrlDetection: boolean;
    supportedLanguageCodes: string[];
    langCodeMap: Record<string, SupportedLanguage>;
    // SEO Configuration
    seo: {
      enabled: boolean;
      basePath: string;
      autoUpdate: boolean;
      baseDomain?: string;
      defaultConfig?: any;
    };
  };
  
  // SEO Functions
  loadSEOForPath: (path: string) => Promise<void>;
  getCurrentSEOData: (path?: string) => any;
  applySEOToPage: (seoData: any, path: string) => void;
  isSEOLoading: boolean;
  
  // Helper functions for TypeScript intellisense
  getSupportedLanguages: () => SupportedLanguage[];
  getSupportedTones: () => TranslationTone[];
  getValidRegionsForLanguage: <T extends SupportedLanguage>(language: T) => readonly Region[];
  
  // Validation helpers
  isValidLanguage: (language: string) => language is SupportedLanguage;
  isValidTone: (tone: string) => tone is TranslationTone;
  isValidRegionForLanguage: <T extends SupportedLanguage>(language: T, region: string) => boolean;
  
  // Internal language setter for URL detection
  _setLanguageFromUrl: (language: SupportedLanguage) => void;
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
  // URL detection props
  enableAutoUrlDetection = true,
  supportedLanguageCodes = ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'nl'],
  onLanguageAutoDetected,
  // SEO Props
  enableSEO = true,
  seoBasePath = '/seo-output',
  autoUpdateMeta = true,
  baseDomain,
  defaultSEOConfig
}) => {
  // Language code mapping
  const langCodeMap = useMemo(() => ({
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'nl': 'Dutch'
  } as Record<string, SupportedLanguage>), []);

  // SEO State Management
  const [seoCache, setSeoCache] = useState<Map<string, SEOData>>(new Map());
  const [currentSEOData, setCurrentSEOData] = useState<any>(null);
  const [isSEOLoading, setIsSEOLoading] = useState(false);

  // Enhanced provider configuration with SEO
  const providerConfig = useMemo(() => ({
    enableAutoUrlDetection,
    supportedLanguageCodes,
    langCodeMap,
    seo: {
      enabled: enableSEO,
      basePath: seoBasePath,
      autoUpdate: autoUpdateMeta,
      baseDomain,
      defaultConfig: defaultSEOConfig
    }
  }), [enableAutoUrlDetection, supportedLanguageCodes, langCodeMap, enableSEO, seoBasePath, autoUpdateMeta, baseDomain, defaultSEOConfig]);

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

  // SEO Helper Functions
  const getLanguageCode = useCallback((lang: string): string => {
    const entry = Object.entries(langCodeMap).find(([code, name]) => name === lang);
    return entry ? entry[0] : 'en';
  }, [langCodeMap]);

  const cleanExistingSEO = useCallback(() => {
    if (typeof window === 'undefined') return;

    document.querySelectorAll('meta[data-polygot-seo]').forEach(tag => tag.remove());
    document.querySelectorAll('script[type="application/ld+json"][data-polygot-seo]').forEach(script => script.remove());
    document.querySelectorAll('link[rel="alternate"][hreflang][data-polygot-seo]').forEach(link => link.remove());
    document.querySelectorAll('link[rel="canonical"][data-polygot-seo]').forEach(link => link.remove());
  }, []);

  const normalizeSEOData = useCallback((rawData: any, path: string) => {
    if (!rawData) return null;

    console.log(`🔍 Detecting SEO schema for path: ${path}`);
    console.log(`📄 Raw SEO data structure:`, Object.keys(rawData));

    // Schema 1: Optimized wrapper format
    if (rawData.optimized) {
      console.log(`📋 Schema detected: Optimized wrapper format`);
      return rawData.optimized;
    }

    // Schema 2: Direct SEO data format
    if (rawData.title || rawData.description) {
      console.log(`📋 Schema detected: Direct SEO data format`);
      return rawData;
    }

    // Schema 3: Social media nested format
    if (rawData.socialMedia) {
      console.log(`📋 Schema detected: Social media nested format`);
      return {
        ...rawData,
        openGraph: rawData.socialMedia.openGraph,
        twitter: rawData.socialMedia.twitter
      };
    }

    // Schema 4: Multi-object format
    if (rawData.seo || rawData.meta || rawData.og) {
      console.log(`📋 Schema detected: Multi-object format`);
      return {
        title: rawData.seo?.title || rawData.meta?.title || rawData.title,
        description: rawData.seo?.description || rawData.meta?.description || rawData.description,
        keywords: rawData.seo?.keywords || rawData.meta?.keywords || rawData.keywords,
        openGraph: rawData.og || rawData.openGraph,
        twitter: rawData.twitter,
        canonical: rawData.canonical || rawData.seo?.canonical,
        structuredData: rawData.structuredData || rawData.schema || rawData.jsonLd,
        hreflang: rawData.hreflang || rawData.alternateLanguages
      };
    }

    console.log(`⚠️ Unknown SEO schema, attempting to extract common fields`);
    return rawData;
  }, []);

  // Load SEO for specific path
  const loadSEOForPath = useCallback(async (path: string) => {
    if (!enableSEO || typeof window === 'undefined') return;

    const langCode = getLanguageCode(targetLanguage);
    const cacheKey = `${langCode}:${path}`;

    // Check cache first
    if (seoCache.has(cacheKey)) {
      const cachedData = seoCache.get(cacheKey);
      setCurrentSEOData(cachedData);
      if (autoUpdateMeta && cachedData) {
        applySEOToPage(cachedData, path);
      }
      console.log(`📋 Using cached SEO data for ${path}`);
      return;
    }

    setIsSEOLoading(true);
    
    try {
      const cleanPath = path.replace(new RegExp(`^/(${supportedLanguageCodes.join('|')})`), '') || '/';
      const seoUrl = `${seoBasePath}/${langCode}.json`;
      
      console.log(`🔍 Loading SEO data for ${cleanPath} in ${targetLanguage} (${langCode})`);
      
      cleanExistingSEO();
      
      const seoResponse = await fetch(seoUrl, {
        headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }
      });
      
      console.log(`📄 Response status: ${seoResponse.status}, OK: ${seoResponse.ok}`);
      
      if (seoResponse.ok) {
        const responseText = await seoResponse.text();
        console.log(`📄 Response length: ${responseText.length} characters`);
        
        if (!responseText.trim().startsWith('<!doctype') && !responseText.trim().startsWith('<html')) {
          const seoJson = JSON.parse(responseText);
          console.log(`📄 Parsed JSON keys:`, Object.keys(seoJson));
          
          const pageSeoData = seoJson[cleanPath];
          console.log(`📄 Looking for path: "${cleanPath}"`);
          console.log(`📄 Found SEO data:`, pageSeoData ? 'YES' : 'NO');
          
          if (pageSeoData) {
            const normalizedSEO = normalizeSEOData(pageSeoData, cleanPath);
            
            if (normalizedSEO) {
              // Cache the result
              setSeoCache(prev => new Map(prev).set(cacheKey, normalizedSEO));
              setCurrentSEOData(normalizedSEO);
              
              if (autoUpdateMeta) {
                applySEOToPage(normalizedSEO, path);
              }
              
              console.log(`✅ SEO data loaded and cached for ${cleanPath} in ${targetLanguage}`);
            }
          } else {
            console.warn(`⚠️ No SEO data found for ${cleanPath} in ${targetLanguage}`);
            console.log(`📄 Available paths in JSON:`, Object.keys(seoJson));
            setCurrentSEOData(null);
          }
        } else {
          console.log(`📄 No SEO file found for ${langCode}, using default (no SEO optimization)`);
          setCurrentSEOData(null);
        }
      } else {
        console.warn(`⚠️ SEO file not found: ${seoUrl} (Status: ${seoResponse.status})`);
        setCurrentSEOData(null);
      }
    } catch (error) {
      console.error(`❌ Error loading SEO for ${path}:`, error);
      setCurrentSEOData(null);
    } finally {
      setIsSEOLoading(false);
    }
  }, [enableSEO, targetLanguage, getLanguageCode, seoBasePath, supportedLanguageCodes, autoUpdateMeta, seoCache, normalizeSEOData, cleanExistingSEO]);

  // Apply SEO to current page
  const applySEOToPage = useCallback((seoData: any, path: string) => {
    if (!seoData || typeof window === 'undefined') return;

    const langCode = getLanguageCode(targetLanguage);
    
    try {
      console.log(`🔧 Applying SEO optimizations for ${langCode} on ${path}`);
      
      const updateOrCreateMeta = (name: string, content: string, attribute = 'name') => {
        if (!content) return;
        
        let metaTag = document.querySelector(`meta[${attribute}="${name}"]`);
        if (!metaTag) {
          metaTag = document.createElement('meta');
          metaTag.setAttribute(attribute, name);
          metaTag.setAttribute('data-polygot-seo', 'true');
          document.head.appendChild(metaTag);
        }
        metaTag.setAttribute('content', content);
      };

      // Apply SEO data with flexible field mapping
      const title = seoData.title || seoData.pageTitle || seoData.seo?.title || seoData.meta?.title;
      if (title) {
        document.title = title;
        console.log(`✅ Title updated to: ${title}`);
      }

      const description = seoData.description || seoData.pageDescription || seoData.seo?.description || seoData.meta?.description;
      if (description) updateOrCreateMeta('description', description);

      const keywords = seoData.keywords || seoData.seo?.keywords || seoData.meta?.keywords;
      if (keywords?.length > 0) {
        const keywordString = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        updateOrCreateMeta('keywords', keywordString);
      }

      // Technical SEO
      const robots = seoData.robots || seoData.seo?.robots || 'index, follow, max-snippet:-1, max-image-preview:large';
      updateOrCreateMeta('robots', robots);
      updateOrCreateMeta('viewport', 'width=device-width, initial-scale=1.0');
      
      const themeColor = seoData.themeColor || seoData.theme_color || defaultSEOConfig?.themeColor || '#ffffff';
      updateOrCreateMeta('theme-color', themeColor);
      
      if (seoData.author || defaultSEOConfig?.author) {
        updateOrCreateMeta('author', seoData.author || defaultSEOConfig?.author);
      }
      if (seoData.publisher || defaultSEOConfig?.publisher) {
        updateOrCreateMeta('publisher', seoData.publisher || defaultSEOConfig?.publisher);
      }

      // Open Graph tags
      const ogData = seoData.openGraph || seoData.og || seoData.socialMedia?.openGraph;
      if (ogData) {
        Object.entries(ogData).forEach(([key, value]) => {
          if (value) updateOrCreateMeta(`og:${key}`, String(value), 'property');
        });
      }

      // Twitter Card tags
      const twitterData = seoData.twitter || seoData.twitterCard || seoData.socialMedia?.twitter;
      if (twitterData) {
        Object.entries(twitterData).forEach(([key, value]) => {
          if (value) updateOrCreateMeta(`twitter:${key}`, String(value));
        });
      }

      // Canonical URL
      const canonical = seoData.canonical || seoData.canonicalUrl || seoData.metaTags?.canonical || seoData.seo?.canonical;
      if (canonical) {
        let canonicalTag = document.querySelector('link[rel="canonical"]');
        if (!canonicalTag) {
          canonicalTag = document.createElement('link');
          canonicalTag.setAttribute('rel', 'canonical');
          canonicalTag.setAttribute('data-polygot-seo', 'true');
          document.head.appendChild(canonicalTag);
        }
        canonicalTag.setAttribute('href', canonical);
      }

      // Hreflang tags
      const hreflangData = seoData.hreflang || seoData.alternateLanguages || seoData.technicalSEO?.hreflang;
      if (hreflangData) {
        hreflangData.forEach((hreflang: any) => {
          const link = document.createElement('link');
          link.setAttribute('rel', 'alternate');
          link.setAttribute('hreflang', hreflang.lang || hreflang.language || hreflang.hreflang);
          link.setAttribute('href', hreflang.url || hreflang.href);
          link.setAttribute('data-polygot-seo', 'true');
          document.head.appendChild(link);
        });
      } else {
        // Auto-generate hreflang tags
        supportedLanguageCodes.forEach(code => {
          const link = document.createElement('link');
          link.setAttribute('rel', 'alternate');
          link.setAttribute('hreflang', code);
          link.setAttribute('href', `${baseDomain || window.location.origin}${code === 'en' ? '' : `/${code}`}${path}`);
          link.setAttribute('data-polygot-seo', 'true');
          document.head.appendChild(link);
        });
        
        // Add x-default hreflang
        const defaultLink = document.createElement('link');
        defaultLink.setAttribute('rel', 'alternate');
        defaultLink.setAttribute('hreflang', 'x-default');
        defaultLink.setAttribute('href', `${baseDomain || window.location.origin}${path}`);
        defaultLink.setAttribute('data-polygot-seo', 'true');
        document.head.appendChild(defaultLink);
      }

      // Structured Data
      const structuredData = seoData.structuredData || seoData.schema || seoData.jsonLd || seoData.ldJson;
      if (structuredData) {
        const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];
        dataArray.forEach((schema: any, index: number) => {
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.setAttribute('data-polygot-seo', 'true');
          script.setAttribute('data-schema-index', index.toString());
          script.textContent = JSON.stringify({
            '@context': 'https://schema.org',
            ...schema
          });
          document.head.appendChild(script);
        });
      }

      // Set language attribute
      document.documentElement.setAttribute('lang', langCode);
      
      console.log(`✅ SEO optimizations applied for ${langCode} on ${path}`);
    } catch (error) {
      console.error('Failed to apply SEO optimizations:', error);
    }
  }, [targetLanguage, getLanguageCode, supportedLanguageCodes, baseDomain, defaultSEOConfig]);

  // Get current SEO data
  const getCurrentSEOData = useCallback((path?: string) => {
    if (!path) return currentSEOData;
    
    const langCode = getLanguageCode(targetLanguage);
    const cacheKey = `${langCode}:${path}`;
    return seoCache.get(cacheKey) || null;
  }, [currentSEOData, targetLanguage, getLanguageCode, seoCache]);

  // Clear everything when target or source language changes
  useEffect(() => {
    setTranslations({});
    setTranslationMetadata({});
    pendingTranslations.current.clear();
    setInflightRequests(new Set());
    setError(null);
    
    // Clear SEO cache when language changes
    setSeoCache(new Map());
    setCurrentSEOData(null);
    
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
      // Clean up SEO elements
      cleanExistingSEO();
    };
  }, [cleanExistingSEO]);

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
        return s
      });

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
      return text;
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

  // Enhanced language setter with callback and SEO reload
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

    // Auto-reload SEO when language changes
    if (enableSEO && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      loadSEOForPath(currentPath);
    }

    // Notify callback
    onLanguageAutoDetected?.(language, 'manual');
  }, [onLanguageAutoDetected, enableSEO, loadSEOForPath]);

  // Internal setter for URL detection with SEO reload
  const _setLanguageFromUrl = useCallback((language: SupportedLanguage) => {
    console.log(`🌍 Provider: URL detected language change to: ${language}`);
    setTargetLanguageState(language);
    
    // Auto-reload SEO when language changes from URL
    if (enableSEO && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      loadSEOForPath(currentPath);
    }
    
    onLanguageAutoDetected?.(language, 'url');
  }, [onLanguageAutoDetected, enableSEO, loadSEOForPath]);

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
    
    // Clear SEO cache
    setSeoCache(new Map());
    setCurrentSEOData(null);
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

  // Enhanced context value with SEO functions
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
    providerConfig,
    // SEO Functions
    loadSEOForPath,
    getCurrentSEOData,
    applySEOToPage,
    isSEOLoading,
    getSupportedLanguages,
    getSupportedTones,
    getValidRegionsForLanguage: getValidRegionsForLanguageHelper,
    isValidLanguage,
    isValidTone: (tone: string): tone is TranslationTone => TRANSLATION_TONES.includes(tone as TranslationTone),
    isValidRegionForLanguage,
    _setLanguageFromUrl,
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
    providerConfig,
    loadSEOForPath,
    getCurrentSEOData,
    applySEOToPage,
    isSEOLoading,
    getSupportedLanguages,
    getSupportedTones,
    getValidRegionsForLanguageHelper,
    _setLanguageFromUrl,
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
