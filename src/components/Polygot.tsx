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
  sourceLanguage?: string; // Add source language prop
}

export const Polygot = ({
  children,
  debounceMs = 100,
  maxRetries = 5,
  sourceLanguage = 'en', // Default to English
}: PolygotProps) => {
  const { t, language, currentOptions, isLoading, inflightRequests } = usePolygot();

  const [translatedChildren, setTranslatedChildren] = useState<ReactNode | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const originalChildrenRef = useRef<ReactNode>(null);
  const extractedStringsRef = useRef<string[]>([]);
  const retryCountRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Build the translation options object from current options
  const translationOptions = useMemo(() => ({
    tone: currentOptions.tone,
    region: currentOptions.region,
    context: currentOptions.context,
  }), [currentOptions]);

  // Determine if translation is needed based on language and option differences
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

  // Track if children changed (shallow equality)
  const childrenChanged = useMemo(() => {
    const changed = originalChildrenRef.current !== children;
    if (changed) {
      originalChildrenRef.current = children;
    }
    return changed;
  }, [children]);

  // Extract strings to translate only when children change and translation needed
  const extractedStrings = useMemo(() => {
    if (!needsTranslation) {
      console.log('🚫 Skipping string extraction - no translation needed');
      return [];
    }

    if (childrenChanged || extractedStringsRef.current.length === 0) {
      console.log('🔄 Extracting strings from children');
      const strings = extractStrings(children);
      extractedStringsRef.current = strings;
      console.log(`📝 Extracted ${strings.length} strings:`, strings.slice(0, 3));
      return strings;
    }
    return extractedStringsRef.current;
  }, [children, childrenChanged, needsTranslation]);

  // Create stable translation dependency key only when translation is needed
  const translationKey = useMemo(() => {
    if (!needsTranslation) {
      return null;
    }

    return JSON.stringify({
      language,
      tone: currentOptions.tone,
      region: currentOptions.region,
      context: currentOptions.context,
      stringsHash: extractedStrings.join('|'),
    });
  }, [language, currentOptions, extractedStrings, needsTranslation]);

  // Helper: generate cache key for each string with options as used in t
  const getCacheKey = useCallback(
    (text: string) => `${text}|||${JSON.stringify(translationOptions)}`,
    [translationOptions]
  );

  // Translation function with retry logic
  const performTranslation = useCallback(() => {
    if (!needsTranslation) {
      console.log('🚫 Skipping translation - not needed');
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

    console.log(`🔄 Attempting translation (attempt ${retryCountRef.current + 1})`);
    setIsTranslating(true);

    // Use options when calling t to get translation cache consistent
    const translatedStrings = extractedStrings.map(str => t(str, translationOptions));

    // Pending means inflight or untranslated (t(str, options) === str means untranslated)
    const pendingStrings = extractedStrings.filter(str => {
      const cacheKey = getCacheKey(str);
      return inflightRequests.has(cacheKey) || t(str, translationOptions) === str;
    });

    console.log(`📊 Translation status: ${translatedStrings.length - pendingStrings.length}/${translatedStrings.length} complete`);
    console.log(`🚀 Pending: ${pendingStrings.length}, In-flight: ${inflightRequests.size}`);

    if (pendingStrings.length === 0) {
      console.log('✅ All translations complete, rendering');
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
  ]);

  // Reset translated children when translation is not needed
  useEffect(() => {
    if (!needsTranslation) {
      console.log('🔄 Resetting to original children - no translation needed');
      setTranslatedChildren(null);
      setIsTranslating(false);
      retryCountRef.current = 0;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [needsTranslation]);

  // Trigger translation only when needed and key changes
  useEffect(() => {
    if (!needsTranslation || !translationKey) {
      return;
    }

    console.log('🎯 Translation key changed, starting translation process');
    console.log(`🌍 Language: ${language}, Options:`, currentOptions);

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
  }, [translationKey, performTranslation, needsTranslation, language, currentOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debug logs
  useEffect(() => {
    console.log(
      `🔍 Polygot state - Needs Translation: ${needsTranslation}, Translating: ${isTranslating}, Loading: ${isLoading}, In-flight: ${inflightRequests.size}`
    );
  }, [isTranslating, isLoading, inflightRequests.size, needsTranslation]);

  // Early return if no translation needed
  if (!needsTranslation) {
    console.log('🎨 Rendering original children - no translation needed');
    return <>{children}</>;
  }

  // While translating but no translated children yet, render original
  if (isTranslating && !translatedChildren) {
    console.log('⏳ Showing original children while translating');
    return <>{children}</>;
  }

  console.log('🎨 Rendering translated children');
  return <>{translatedChildren || children}</>;
};

interface NoPolygotProps {
  children: ReactNode;
}

export const NoPolygot = ({ children }: NoPolygotProps) => {
  return <>{children}</>;
};

NoPolygot.displayName = 'NoPolygot';
