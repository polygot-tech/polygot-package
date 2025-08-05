import React, {
  useState,
  useEffect,
  useMemo,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { extractStrings, replaceStrings } from '../utils/domTraverse';
import { usePolygot } from '../hooks/usePolygot';

interface PolygotProps {
  children: ReactNode;
  debounceMs?: number;
  maxRetries?: number;
  sourceLanguage?: string;
  // Only pageUrl needed for SEO (provider handles the rest)
  pageUrl?: string;
  showLoadingIndicator?: boolean;
  loadingComponent?: ReactNode;
}

export const Polygot = ({
  children,
  debounceMs = 100,
  maxRetries = 5,
  sourceLanguage = 'English',
  pageUrl, // Only SEO prop needed
  showLoadingIndicator = true,
  loadingComponent
}: PolygotProps) => {
  const { 
    t, 
    language, 
    currentOptions, 
    isLoading, 
    inflightRequests, 
    providerConfig,
    _setLanguageFromUrl,
    loadSEOForPath, // Get SEO function from provider
    isSEOLoading // Get SEO loading state from provider
  } = usePolygot();

  const [translatedChildren, setTranslatedChildren] = useState<ReactNode | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [urlLanguageDetected, setUrlLanguageDetected] = useState(false);

  const originalChildrenRef = useRef<ReactNode>(null);
  const extractedStringsRef = useRef<string[]>([]);
  const retryCountRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // URL Language Detection with automatic SEO loading (provider handles SEO)
  useEffect(() => {
    if (typeof window === 'undefined' || !providerConfig.enableAutoUrlDetection) return;

    const detectAndSetLanguage = () => {
      const pathSegments = window.location.pathname.split('/').filter(Boolean);
      const langCode = pathSegments[0];
      
      let detectedLanguage = 'English';
      const currentPath = pageUrl || window.location.pathname;
      
      if (langCode && providerConfig.langCodeMap[langCode]) {
        detectedLanguage = providerConfig.langCodeMap[langCode];
        console.log(`🌍 Polygot: Auto-detected language from URL: ${detectedLanguage} (/${langCode})`);
      } else {
        console.log(`🌍 Polygot: Using default language: ${detectedLanguage}`);
      }
      
      if (detectedLanguage !== language) {
        _setLanguageFromUrl(detectedLanguage as any);
        setUrlLanguageDetected(true);
      }
      
      // AUTOMATIC: SEO loads automatically from provider
      if (providerConfig.seo.enabled) {
        loadSEOForPath(currentPath);
      }
    };

    detectAndSetLanguage();

    const handleURLChange = () => {
      setUrlLanguageDetected(false);
      setTimeout(detectAndSetLanguage, 0);
    };

    window.addEventListener('popstate', handleURLChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleURLChange();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleURLChange();
    };

    return () => {
      window.removeEventListener('popstate', handleURLChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [language, _setLanguageFromUrl, providerConfig, loadSEOForPath, pageUrl]);

  // Build the translation options object from current options
  const translationOptions = useMemo(() => ({
    tone: currentOptions.tone,
    region: currentOptions.region,
    context: currentOptions.context,
  }), [currentOptions]);

  // Determine if translation is needed
  const needsTranslation = useMemo(() => {
    const targetLang = language?.toLowerCase();
    const sourceLang = sourceLanguage?.toLowerCase();

    const defaultRegion = 'US';
    const defaultTone = 'neutral';
    const defaultContext = '';

    const regionDiffers = currentOptions.region && currentOptions.region.toUpperCase() !== defaultRegion;
    const toneDiffers = (currentOptions.tone || defaultTone) !== defaultTone;
    const contextDiffers = (currentOptions.context || defaultContext) !== defaultContext;

    if (!targetLang) return false;
    if (
      targetLang !== sourceLang ||
      regionDiffers ||
      toneDiffers ||
      contextDiffers
    ) {
      return true;
    }
    return false;
  }, [language, sourceLanguage, currentOptions]);

  // Track if children changed
  const childrenChanged = useMemo(() => {
    const changed = originalChildrenRef.current !== children;
    if (changed) {
      originalChildrenRef.current = children;
    }
    return changed;
  }, [children]);

  // Extract strings for translation
  const extractedStrings = useMemo(() => {
    if (!needsTranslation) {
      console.log('🚫 Polygot: Skipping string extraction - no translation needed');
      return [];
    }

    if (childrenChanged || extractedStringsRef.current.length === 0) {
      console.log('🔄 Polygot: Extracting strings from children');
      const strings = extractStrings(children);
      extractedStringsRef.current = strings;
      console.log(`📝 Extracted ${strings.length} strings for translation to ${language}`);
      return strings;
    }
    return extractedStringsRef.current;
  }, [children, childrenChanged, needsTranslation, language]);

  // Create stable translation dependency key
  const translationKey = useMemo(() => {
    if (!needsTranslation) return null;

    return JSON.stringify({
      language,
      tone: currentOptions.tone,
      region: currentOptions.region,
      context: currentOptions.context,
      stringsHash: extractedStrings.join('|'),
    });
  }, [language, currentOptions, extractedStrings, needsTranslation]);

  // Helper: generate cache key for each string
  const getCacheKey = useCallback(
    (text: string) => `${text}|||${JSON.stringify(translationOptions)}`,
    [translationOptions]
  );

  // Translation function with retry logic
  const performTranslation = useCallback(() => {
    if (!needsTranslation) {
      console.log('🚫 Polygot: Skipping translation - not needed');
      setTranslatedChildren(children);
      setIsTranslating(false);
      return;
    }

    if (extractedStrings.length === 0) {
      console.log('✅ No strings to translate');
      setTranslatedChildren(children);
      setIsTranslating(false);
      return;
    }

    console.log(`🔄 Polygot: Attempting translation to ${language} (attempt ${retryCountRef.current + 1})`);
    setIsTranslating(true);

    const translatedStrings = extractedStrings.map(str => t(str, translationOptions));

    const pendingStrings = extractedStrings.filter(str => {
      const cacheKey = getCacheKey(str);
      return inflightRequests.has(cacheKey) || t(str, translationOptions) === str;
    });

    console.log(`📊 Translation status: ${translatedStrings.length - pendingStrings.length}/${translatedStrings.length} complete`);

    if (pendingStrings.length === 0) {
      console.log(`✅ All translations complete, rendering in ${language}`);
      const newChildren = replaceStrings(children, translatedStrings);
      setTranslatedChildren(newChildren);
      setIsTranslating(false);
      retryCountRef.current = 0;
    } else if (retryCountRef.current < maxRetries) {
      console.log(`⏳ ${pendingStrings.length} translations pending, retrying in ${debounceMs}ms`);
      retryCountRef.current++;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        performTranslation();
      }, debounceMs);
    } else {
      console.warn(`⚠️ Max retries (${maxRetries}) reached, rendering with partial translations`);
      const newChildren = replaceStrings(children, translatedStrings);
      setTranslatedChildren(newChildren);
      setIsTranslating(false);
      retryCountRef.current = 0;
    }
  }, [
    extractedStrings,
    children,
    t,
    inflightRequests,
    debounceMs,
    maxRetries,
    needsTranslation,
    translationOptions,
    getCacheKey,
    language,
  ]);

  // Reset translated children when translation is not needed
  useEffect(() => {
    if (!needsTranslation) {
      console.log('🔄 Polygot: Resetting to original children - no translation needed');
      setTranslatedChildren(null);
      setIsTranslating(false);
      retryCountRef.current = 0;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [needsTranslation]);

  // Trigger translation when needed
  useEffect(() => {
    if (!needsTranslation || !translationKey) return;

    console.log(`🎯 Polygot: Translation key changed, starting translation process to ${language}`);
    retryCountRef.current = 0;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    performTranslation();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [translationKey, performTranslation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Custom loading component (now uses provider's SEO loading state)
  const LoadingComponent = useMemo(() => {
    if (loadingComponent) return loadingComponent;
    
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <div style={{
          width: '12px',
          height: '12px',
          border: '2px solid #ffffff40',
          borderTop: '2px solid #ffffff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        {isSEOLoading ? '🔍 Loading SEO...' : '🔄 Translating...'}
      </div>
    );
  }, [loadingComponent, isSEOLoading]);

  // Show loading if needed (uses provider's SEO loading state)
  if (showLoadingIndicator && ((isTranslating && !translatedChildren) || isSEOLoading)) {
    return (
      <>
        {children}
        {LoadingComponent}
      </>
    );
  }

  // Early return if no translation needed
  if (!needsTranslation) {
    console.log(`🎨 Polygot: Rendering original children in ${language} - no translation needed`);
    return <>{children}</>;
  }

  // While translating but no translated children yet, render original
  if (isTranslating && !translatedChildren) {
    console.log(`⏳ Polygot: Showing original children while translating to ${language}`);
    return <>{children}</>;
  }

  console.log(`🎨 Polygot: Rendering translated children in ${language}`);
  return <>{translatedChildren || children}</>;
};

// Add CSS animation for loading spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}


export const NoPolygot = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};

NoPolygot.displayName = 'NoPolygot';