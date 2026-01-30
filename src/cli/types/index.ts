export interface PolygotConfig {
  api: {
    appId: string;
  };
  translation: {
    enabled: boolean;
    sourceLanguage: string;
    targetLanguages: string[];
    tone: string;
    region?: string;
    context?: string;
    sources: string[];
    outputDir: string;
    options: {
      preserveWhitespace: boolean;
      skipTechnicalStrings: boolean;
    };
  };
  seo: {
    enabled: boolean;
    languages: string[];
    content: {
      pages: Record<string, {
        title: string;
        description: string;
        keywords: string[];
        industry: string;
        // Enhanced content types
        faqs?: Array<{ question: string; answer: string }>;
        products?: Array<{ name: string; price?: number; description?: string; availability?: string }>;
        events?: Array<{ name: string; startDate: string; endDate?: string; location?: string }>;
        reviews?: Array<{ rating: number; author: string; reviewBody: string }>;
      }>;
      global: {
        siteName: string;
        author: string;
        twitterHandle: string;
        defaultImage: string;
        canonicalUrl: string;
      };
    };
    optimization: {
      level?: 'basic' | 'standard' | 'advanced' | 'enterprise';
      titleMaxLength: number;
      descriptionMaxLength: number;
      keywordDensity: number;
      includeLocalSEO: boolean;
      socialMedia: boolean;
      structuredData: boolean;
      generateSitemap: boolean;
      // Enhanced sitemap options
      includeImages?: boolean;
      includeVideos?: boolean;
      includeNews?: boolean;
      includeMobile?: boolean;
      includeGeo?: boolean;
      maxUrlsPerSitemap?: number;
      compressionLevel?: 'none' | 'gzip' | 'brotli';
      splitLargeFiles?: boolean;
      generateRobotsTxt?: boolean;
      validateUrls?: boolean;
      // Performance and accessibility
      mobileOptimized?: boolean;
      voiceSearchOptimized?: boolean;
      internationalSEO?: boolean;
      accessibilityCompliant?: boolean;
      performanceOptimized?: boolean;
    };
    outputDir: string;
  };
  // Enhanced business info for better SEO
  businessInfo?: {
    name?: string;
    type?: 'ecommerce' | 'blog' | 'corporate' | 'portfolio' | 'news' | 'local-business' | 'saas' | 'educational' | 'nonprofit' | 'other';
    location?: {
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
      lat?: string;
      lon?: string;
    };
    contactInfo?: {
      phone?: string;
      email?: string;
      website?: string;
    };
    socialProfiles?: Array<{ platform: string; url: string }>;
  };
  // Target audience information
  targetAudience?: {
    age?: string;
    interests?: string[];
    searchBehavior?: string;
    painPoints?: string[];
  };
}

export interface TranslationOptions {
  tone?: string;
  region?: string;
  context?: string;
}

export interface SEOOptions {
  region?: string;
  industry?: string;
  tone?: string;
  keywords?: string;
  titleMax?: number;
  descMax?: number;
}

export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
  alternates?: Array<{ lang: string; url: string }>;
  images?: Array<{ url: string; caption?: string; title?: string; license?: string }>;
  videos?: Array<{
    url: string;
    title: string;
    description: string;
    thumbnail?: string;
    duration?: number;
  }>;
  mobile?: boolean;
  geo?: {
    lat: number;
    lon: number;
  };
  language?: string;
}
