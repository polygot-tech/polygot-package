import path from 'path';
import { PolygotConfig, SEOOptions } from '../types/index.js';
import { ensureDir, writeJsonFile } from '../utils/file-utils.js';
import { generateEnhancedSitemap } from '../utils/sitemap.js';
import { sleep } from '../utils/helpers.js';

/**
 * Enhanced SEO optimization with flexible levels and features
 */
export async function performSEOOptimization(config: PolygotConfig): Promise<any> {
  if (!config.seo.enabled) {
    console.log('🔍 SEO optimization disabled, skipping...');
    return null;
  }

  console.log('🔍 Starting enhanced SEO optimization...');
  const optimizationLevel = config.seo.optimization.level || 'standard';
  console.log(`   - Optimization Level: ${optimizationLevel.toUpperCase()}`);

  await ensureDir(config.seo.outputDir);

  const results = {
    languages: config.seo.languages,
    pages: Object.keys(config.seo.content.pages),
    optimizations: {} as Record<string, any>,
    level: optimizationLevel
  };

  for (const language of config.seo.languages) {
    console.log(`\n🔍 Optimizing SEO for ${language.toUpperCase()}...`);
    
    const languageResults: Record<string, any> = {};
    
    for (const [pagePath, pageContent] of Object.entries(config.seo.content.pages)) {
      console.log(`  - Processing page: ${pagePath} (Level: ${optimizationLevel})`);
      
      try {
        // Enhanced SEO request with new features
        const seoRequest = {
          content: {
            title: pageContent.title,
            description: pageContent.description,
            keywords: pageContent.keywords,
            // Enhanced content types
            faqs: pageContent.faqs,
            products: pageContent.products,
            events: pageContent.events,
            reviews: pageContent.reviews,
            metaTags: {
              author: config.seo.content.global.author,
              'twitter:site': config.seo.content.global.twitterHandle,
              canonical: `${config.seo.content.global.canonicalUrl}${pagePath}`,
              'og:site_name': config.seo.content.global.siteName,
              'og:image': config.seo.content.global.defaultImage
            }
          },
          language: language,
          industry: pageContent.industry,
          tone: 'professional',
          // Enhanced targeting
          businessInfo: config.businessInfo,
          targetAudience: config.targetAudience,
          optimization: {
            level: optimizationLevel,
            titleMaxLength: config.seo.optimization.titleMaxLength,
            descriptionMaxLength: config.seo.optimization.descriptionMaxLength,
            keywordDensity: config.seo.optimization.keywordDensity,
            includeLocalSEO: config.seo.optimization.includeLocalSEO,
            socialMedia: config.seo.optimization.socialMedia,
            structuredData: config.seo.optimization.structuredData,
            mobileOptimized: config.seo.optimization.mobileOptimized ?? true,
            voiceSearchOptimized: config.seo.optimization.voiceSearchOptimized ?? false,
            internationalSEO: config.seo.optimization.internationalSEO ?? false,
            accessibilityCompliant: config.seo.optimization.accessibilityCompliant ?? true,
            performanceOptimized: config.seo.optimization.performanceOptimized ?? true
          }
        };

        const response = await fetch('http://localhost:3000/api/v1/translate/seo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.api.appId}`
          },
          body: JSON.stringify(seoRequest)
        });

        if (!response.ok) {
          throw new Error(`SEO API error: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          languageResults[pagePath] = result.data;
          console.log(`    - ✅ SEO Score: ${result.data.analysis.seoScore}/100`);
          console.log(`    - Mobile Score: ${result.data.analysis.mobileScore || 'N/A'}/100`);
          console.log(`    - Performance Score: ${result.data.analysis.performanceScore || 'N/A'}/100`);
          
          // Show optimization level benefits
          if (optimizationLevel === 'advanced' || optimizationLevel === 'enterprise') {
            console.log(`    - Accessibility Score: ${result.data.analysis.accessibilityScore || 'N/A'}/100`);
          }
        }

        await sleep(300); // Longer delay for complex optimizations
        
      } catch (error: any) {
        console.error(`    - Failed to optimize ${pagePath}: ${error}`);
        languageResults[pagePath] = { 
          error: error.toString(),
          level: optimizationLevel,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    results.optimizations[language] = languageResults;
    
    const outputPath = path.join(config.seo.outputDir, `${language}.json`);
    await writeJsonFile(outputPath, languageResults);
    console.log(`  - ✅ Saved ${optimizationLevel} SEO optimization to ${outputPath}`);
  }

  // Enhanced sitemap generation
  if (config.seo.optimization.generateSitemap) {
    await generateEnhancedSitemap(config, results);
  }

  return results;
}

/**
 * SEO optimization for individual files
 */
export async function optimizeSEOContent(
  configPath: string,
  language: string,
  appId: string,
  options: SEOOptions = {}
): Promise<void> {
  console.log(`🔍 Optimizing SEO content for ${language.toUpperCase()}`);
  
  try {
    const { promises: fs } = await import('fs');
    const configContent = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    const optimizationRequest = {
      content: config.content || config,
      language: language,
      region: options.region,
      industry: options.industry,
      keywords: options.keywords ? options.keywords.split(',').map(k => k.trim()) : undefined,
      tone: options.tone || 'professional',
      optimization: {
        titleMaxLength: options.titleMax || 60,
        descriptionMaxLength: options.descMax || 160,
        keywordDensity: 1.5,
        includeLocalSEO: !!options.region,
        socialMedia: true,
        structuredData: true
      }
    };

    const response = await fetch('http://localhost:3000/api/v1/translate/seo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appId}`
      },
      body: JSON.stringify(optimizationRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SEO API returned status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`SEO optimization failed: ${result.error}`);
    }

    const LOCALES_DIR = path.join(process.cwd(), 'locales');
    const outputPath = path.join(LOCALES_DIR, `${language.toLowerCase()}.json`);
    const optimizedContent = {
      ...result.data.optimized,
      analysis: result.data.analysis,
      metadata: {
        language,
        region: options.region,
        optimizedAt: new Date().toISOString()
      }
    };

    await ensureDir(LOCALES_DIR);
    await writeJsonFile(outputPath, optimizedContent);

    console.log(`✅ SEO optimization completed for ${language.toUpperCase()}`);
    console.log(`  - SEO Score: ${result.data.analysis.seoScore}/100`);
    console.log(`  - Output saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ SEO optimization failed:', error);
    process.exit(1);
  }
}
