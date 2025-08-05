// server/seo.ts
import 'server-only'
import { cache } from 'react'

const seoDataCache = new Map<string, any>();

export const getSEOData = cache(async (locale: string, path: string) => {
  const cacheKey = `${locale}:${path}`;
  
  if (seoDataCache.has(cacheKey)) {
    return seoDataCache.get(cacheKey);
  }

  try {
    const seoFile = await import(`../public/seo-output/${locale}.json`)
      .then(module => module.default)
      .catch(() => ({}));
    
    const cleanPath = path.replace(new RegExp(`^/(es|fr|de|it|pt|ru|ja|ko|zh|ar|hi|nl)`), '') || '/';
    const seoData = seoFile[cleanPath];
    
    if (seoData) {
      const normalized = normalizeSEOData(seoData, cleanPath);
      seoDataCache.set(cacheKey, normalized);
      return normalized;
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to load SEO data for ${locale}:${path}`, error);
    return null;
  }
});

function normalizeSEOData(rawData: any, path: string) {
  if (!rawData) return null;

  // Schema 1: Optimized wrapper format
  if (rawData.optimized) {
    return rawData.optimized;
  }

  // Schema 2: Direct SEO data format
  if (rawData.title || rawData.description) {
    return rawData;
  }

  // Schema 3: Social media nested format
  if (rawData.socialMedia) {
    return {
      ...rawData,
      openGraph: rawData.socialMedia.openGraph,
      twitter: rawData.socialMedia.twitter
    };
  }

  // Schema 4: Multi-object format
  if (rawData.seo || rawData.meta || rawData.og) {
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

  return rawData;
}
