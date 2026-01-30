interface TranslationMetadata {
  cached: boolean;
  processingTime: number;
  sourceLanguage: string;
  targetLanguage: string;
  tone: string;
  region?: string;
  autoDetected: boolean;
  timestamp: string;
}

interface TranslationResponse {
  success: boolean;
  data: string | string[] | Record<string, string>;
  metadata: TranslationMetadata;
}

interface TranslationOptions {
  tone?: "professional" | "casual" | "formal" | "friendly" | "academic" | "conversational" | "business" | "creative" | "technical" | "diplomatic" | "neutral";
  region?: string;
  context?: string;
}

const translationCache = new Map<string, any>();

export const fetchTranslations = async (
  stringsToTranslate: string | string[] | Record<string, string>,
  targetLang: string,
  appId: string,
  sourceLang?: string, // Now optional for auto-detection
  options?: TranslationOptions
): Promise<string | string[] | Record<string, string>> => {
  
  // Create cache key including all parameters that affect translation
  const cacheParams = {
    from: sourceLang,
    to: targetLang,
    input: stringsToTranslate,
    tone: options?.tone || 'neutral',
    region: options?.region,
    context: options?.context
  };
  
  const cacheKey = `translation:${JSON.stringify(cacheParams)}`;
  
  // Check cache first
  if (translationCache.has(cacheKey)) {
    console.log('Serving translation from frontend cache');
    return translationCache.get(cacheKey);
  }

  // Prepare request body
  const requestBody: any = {
    to: targetLang,
    input: stringsToTranslate,
  };

  // Add optional parameters
  if (sourceLang) {
    requestBody.from = sourceLang;
  }
  
  if (options?.tone) {
    requestBody.tone = options.tone;
  }
  
  if (options?.region) {
    requestBody.region = options.region;
  }
  
  if (options?.context) {
    requestBody.context = options.context;
  }

  try {
    const response = await fetch(
      "http://localhost:3000/api/v1/translate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "App-Id": appId,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      let errorMessage: string;
      
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.message || errorBody.error || `HTTP ${response.status}`;
        
        // Handle validation errors
        if (errorBody.details) {
          const validationErrors = errorBody.details.map((detail: any) => 
            `${detail.path?.join('.')}: ${detail.message}`
          ).join(', ');
          errorMessage += ` - Validation errors: ${validationErrors}`;
        }
        
        // Show available tones if tone validation failed
        if (errorBody.availableTones) {
          errorMessage += ` - Available tones: ${errorBody.availableTones.join(', ')}`;
        }
        
      } catch {
        errorMessage = await response.text();
      }
      
      throw new Error(`Translation API request failed with status ${response.status}: ${errorMessage}`);
    }

    const result: TranslationResponse = await response.json();

    // Validate response format
    if (!result.success || result.data === undefined) {
      throw new Error("Invalid response format from translation API.");
    }

    // Log translation metadata for debugging
    console.log('Translation completed:', {
      sourceLanguage: result.metadata.sourceLanguage,
      targetLanguage: result.metadata.targetLanguage,
      tone: result.metadata.tone,
      region: result.metadata.region,
      autoDetected: result.metadata.autoDetected,
      cached: result.metadata.cached,
      processingTime: result.metadata.processingTime
    });

    // Cache the result
    translationCache.set(cacheKey, result.data);
    
    return result.data;

  } catch (error) {
    console.error('Translation request failed:', error);
    
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Translation failed: ${error.message}`);
    } else {
      throw new Error('Translation failed due to unknown error');
    }
  }
};

// Helper function for auto-detection with different tones
export const fetchTranslationsWithAutoDetection = async (
  stringsToTranslate: string | string[] | Record<string, string>,
  targetLang: string,
  appId: string,
  options?: TranslationOptions
): Promise<string | string[] | Record<string, string>> => {
  return fetchTranslations(
    stringsToTranslate,
    targetLang,
    appId,
    undefined, // No source language for auto-detection
    options
  );
};

// Helper function for professional translations
export const fetchProfessionalTranslation = async (
  stringsToTranslate: string | string[] | Record<string, string>,
  targetLang: string,
  appId: string,
  sourceLang?: string,
  region?: string,
  context?: string
): Promise<string | string[] | Record<string, string>> => {
  return fetchTranslations(
    stringsToTranslate,
    targetLang,
    appId,
    sourceLang,
    {
      tone: 'professional',
      region,
      context
    }
  );
};

// Helper function for casual translations
export const fetchCasualTranslation = async (
  stringsToTranslate: string | string[] | Record<string, string>,
  targetLang: string,
  appId: string,
  sourceLang?: string,
  region?: string
): Promise<string | string[] | Record<string, string>> => {
  return fetchTranslations(
    stringsToTranslate,
    targetLang,
    appId,
    sourceLang,
    {
      tone: 'casual',
      region
    }
  );
};

// Helper function for business translations with region support
export const fetchBusinessTranslation = async (
  stringsToTranslate: string | string[] | Record<string, string>,
  targetLang: string,
  appId: string,
  region?: string,
  context?: string,
  sourceLang?: string
): Promise<string | string[] | Record<string, string>> => {
  return fetchTranslations(
    stringsToTranslate,
    targetLang,
    appId,
    sourceLang,
    {
      tone: 'business',
      region,
      context
    }
  );
};

// Helper function to clear translation cache
export const clearTranslationCache = (): void => {
  translationCache.clear();
  console.log('Translation cache cleared');
};

// Helper function to get cache statistics
export const getTranslationCacheStats = (): { size: number; keys: string[] } => {
  return {
    size: translationCache.size,
    keys: Array.from(translationCache.keys())
  };
};
