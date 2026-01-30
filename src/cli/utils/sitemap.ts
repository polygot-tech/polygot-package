import { promises as fs } from 'fs';
import path from 'path';
import { PolygotConfig, SitemapEntry } from '../types/index.js';
import { escapeXml } from './helpers.js';

/**
 * Enhanced sitemap generation with multiple features
 */
export async function generateEnhancedSitemap(config: PolygotConfig, seoResults: any): Promise<void> {
  console.log('\n🗺️  Generating enhanced multilingual sitemap...');
  
  const sitemapOptions = {
    includeImages: config.seo.optimization.includeImages ?? true,
    includeVideos: config.seo.optimization.includeVideos ?? false,
    includeNews: config.seo.optimization.includeNews ?? false,
    includeMobile: config.seo.optimization.includeMobile ?? true,
    includeGeo: config.seo.optimization.includeGeo ?? false,
    maxUrls: config.seo.optimization.maxUrlsPerSitemap ?? 50000,
    compressionLevel: config.seo.optimization.compressionLevel ?? 'none',
    splitLargeFiles: config.seo.optimization.splitLargeFiles ?? true,
    generateRobotsTxt: config.seo.optimization.generateRobotsTxt ?? true,
    validateUrls: config.seo.optimization.validateUrls ?? true
  };

  console.log(`   - Options: Images: ${sitemapOptions.includeImages}, Mobile: ${sitemapOptions.includeMobile}`);
  console.log(`   - Max URLs per file: ${sitemapOptions.maxUrls}`);

  try {
    const urls = Object.keys(config.seo.content.pages);
    const sitemapEntries: SitemapEntry[] = [];
    const baseUrl = config.seo.content.global.canonicalUrl.replace(/\/$/, '');
    
    // Generate enhanced sitemap entries
    for (const urlPath of urls) {
      const pageContent = config.seo.content.pages[urlPath];
      
      for (const lang of config.seo.languages) {
        const isDefaultLang = lang === (config.translation?.sourceLanguage || 'en');
        const localizedUrl = isDefaultLang 
          ? `${baseUrl}${urlPath}`
          : `${baseUrl}/${lang}${urlPath}`;

        // Get SEO results for this page/language if available
        const pageResults = seoResults?.optimizations?.[lang]?.[urlPath];

        // Build alternates for all languages
        const alternates = config.seo.languages.map(altLang => {
          const altIsDefault = altLang === (config.translation?.sourceLanguage || 'en');
          return {
            lang: altLang,
            url: altIsDefault ? `${baseUrl}${urlPath}` : `${baseUrl}/${altLang}${urlPath}`
          };
        });

        // Determine priority based on URL and optimization level
        let priority = urlPath === '/' ? 1.0 : 0.8;
        const optimizationLevel = config.seo.optimization.level || 'standard';
        
        // Boost priority for higher optimization levels
        if (optimizationLevel === 'advanced') priority = Math.min(1.0, priority * 1.1);
        if (optimizationLevel === 'enterprise') priority = Math.min(1.0, priority * 1.2);

        // Determine change frequency based on content type and business type
        let changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly';
        if (config.businessInfo?.type === 'blog' || config.businessInfo?.type === 'news') {
          changefreq = 'daily';
        } else if (config.businessInfo?.type === 'ecommerce') {
          changefreq = urlPath.includes('/product') ? 'weekly' : 'monthly';
        }

        const entry: SitemapEntry = {
          url: localizedUrl,
          lastmod: new Date().toISOString(),
          changefreq,
          priority: priority.toString(),
          alternates,
          language: lang
        };

        // Add enhanced features based on options
        if (sitemapOptions.includeImages && pageResults?.optimized?.imageAlts) {
          entry.images = pageResults.optimized.imageAlts.map((alt: string, index: number) => ({
            url: `${baseUrl}/images/${urlPath.replace('/', '') || 'home'}-${index}.jpg`,
            caption: alt,
            title: alt
          }));
        }

        if (sitemapOptions.includeMobile) {
          entry.mobile = true;
        }

        if (sitemapOptions.includeGeo && config.businessInfo?.location?.lat) {
          entry.geo = {
            lat: parseFloat(config.businessInfo.location.lat),
            lon: parseFloat(config.businessInfo.location.lon || '0')
          };
        }

        sitemapEntries.push(entry);
      }
    }

    // Split into multiple files if needed
    const maxUrls = sitemapOptions.maxUrls;
    if (sitemapOptions.splitLargeFiles && sitemapEntries.length > maxUrls) {
      const chunks: SitemapEntry[][] = [];
      for (let i = 0; i < sitemapEntries.length; i += maxUrls) {
        chunks.push(sitemapEntries.slice(i, i + maxUrls));
      }
      
      console.log(`📂 Splitting sitemap into ${chunks.length} files`);
      
      const sitemapFiles: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const filename:string = `sitemap-${i + 1}.xml`;
        const filePath = path.join(config.seo.outputDir, filename);
        await generateSitemapXML(chunks[i], filePath, sitemapOptions);
        sitemapFiles.push(filename);
      }
      
      // Generate sitemap index
      await generateSitemapIndex(sitemapFiles, baseUrl, config.seo.outputDir);
      
    } else {
      // Single sitemap file
      const filePath = path.join(config.seo.outputDir, 'sitemap.xml');
      await generateSitemapXML(sitemapEntries, filePath, sitemapOptions);
    }

    // Generate robots.txt
    if (sitemapOptions.generateRobotsTxt) {
      await generateRobotsTxt(baseUrl, config.seo.outputDir);
    }

    // Generate sitemap report
    await generateSitemapReport(sitemapEntries, config.seo.outputDir, sitemapOptions);
    
    console.log(`✅ Enhanced sitemap generation completed`);
    console.log(`   - Total URLs: ${sitemapEntries.length}`);
    console.log(`   - Languages: ${config.seo.languages.length}`);
    
  } catch (error) {
    console.error('❌ Enhanced sitemap generation failed:', error);
  }
}

/**
 * Generate XML sitemap file with enhanced features
 */
async function generateSitemapXML(entries: SitemapEntry[], filePath: string, options: any): Promise<void> {
  const namespaces = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    'xmlns:xhtml="http://www.w3.org/1999/xhtml"'
  ];

  if (options.includeImages) {
    namespaces.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
  }
  if (options.includeVideos) {
    namespaces.push('xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"');
  }
  if (options.includeMobile) {
    namespaces.push('xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"');
  }
  if (options.includeGeo) {
    namespaces.push('xmlns:geo="http://www.google.com/geo/schemas/sitemap/1.0"');
  }

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset ${namespaces.join(' ')}>\n`;

  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(entry.url)}</loc>\n`;
    
    if (entry.lastmod) {
      xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
    }
    
    if (entry.changefreq) {
      xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
    }
    
    if (entry.priority) {
      xml += `    <priority>${entry.priority}</priority>\n`;
    }

    // Add alternate language links
    if (entry.alternates && entry.alternates.length > 0) {
      for (const alternate of entry.alternates) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alternate.lang}" href="${escapeXml(alternate.url)}" />\n`;
      }
    }

    // Add images
    if (options.includeImages && entry.images && entry.images.length > 0) {
      for (const image of entry.images) {
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(image.url)}</image:loc>\n`;
        if (image.caption) {
          xml += `      <image:caption>${escapeXml(image.caption)}</image:caption>\n`;
        }
        xml += '    </image:image>\n';
      }
    }

    // Add mobile
    if (options.includeMobile && entry.mobile) {
      xml += '    <mobile:mobile/>\n';
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';

  await fs.writeFile(filePath, xml, 'utf8');
  console.log(`✅ Generated sitemap: ${path.basename(filePath)} (${entries.length} URLs)`);
}

/**
 * Generate sitemap index file
 */
async function generateSitemapIndex(sitemapFiles: string[], baseUrl: string, outputDir: string): Promise<void> {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const lastmod = new Date().toISOString();

  for (const filename of sitemapFiles) {
    xml += '  <sitemap>\n';
    xml += `    <loc>${baseUrl}/${filename}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '  </sitemap>\n';
  }

  xml += '</sitemapindex>';

  const indexPath = path.join(outputDir, 'sitemap.xml');
  await fs.writeFile(indexPath, xml, 'utf8');
  console.log(`✅ Generated sitemap index: sitemap.xml`);
}

/**
 * Generate enhanced robots.txt
 */
async function generateRobotsTxt(baseUrl: string, outputDir: string): Promise<void> {
  let robotsTxt = `# Robots.txt generated by Polygot SEO\n`;
  robotsTxt += `# ${new Date().toISOString()}\n\n`;
  robotsTxt += `User-agent: *\n`;
  robotsTxt += `Allow: /\n`;
  robotsTxt += `Disallow: /api/\n`;
  robotsTxt += `Disallow: /admin/\n`;
  robotsTxt += `Disallow: /*.json$\n`;
  robotsTxt += `Disallow: /*?*utm_*\n`;
  robotsTxt += `Disallow: /*?*ref=*\n\n`;
  robotsTxt += `# Sitemap\n`;
  robotsTxt += `Sitemap: ${baseUrl}/sitemap.xml\n\n`;
  robotsTxt += `# Crawl-delay\n`;
  robotsTxt += `Crawl-delay: 1\n\n`;
  robotsTxt += `# Host (preferred domain)\n`;
  robotsTxt += `Host: ${baseUrl}\n`;

  const robotsPath = path.join(outputDir, 'robots.txt');
  await fs.writeFile(robotsPath, robotsTxt, 'utf8');
  console.log(`✅ Generated robots.txt`);
}

/**
 * Generate sitemap analytics report
 */
async function generateSitemapReport(entries: SitemapEntry[], outputDir: string, options: any): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    totalUrls: entries.length,
    languages: Array.from(new Set(entries.map(e => e.language).filter(Boolean))),
    options: options,
    statistics: {
      priorities: {} as Record<string, number>,
      changeFrequencies: {} as Record<string, number>,
      urlTypes: {} as Record<string, number>,
      imagesCount: entries.reduce((sum, e) => sum + (e.images?.length || 0), 0),
      mobilePages: entries.filter(e => e.mobile).length,
      geoPages: entries.filter(e => e.geo).length
    }
  };

  // Analyze priorities
  entries.forEach(entry => {
    const priority = entry.priority || '0.5';
    report.statistics.priorities[priority] = (report.statistics.priorities[priority] || 0) + 1;
  });

  // Analyze change frequencies
  entries.forEach(entry => {
    const freq = entry.changefreq || 'monthly';
    report.statistics.changeFrequencies[freq] = (report.statistics.changeFrequencies[freq] || 0) + 1;
  });

  // Analyze URL types
  entries.forEach(entry => {
    let type = 'other';
    if (entry.url.endsWith('/')) type = 'page';
    else if (entry.url.includes('/blog/')) type = 'blog';
    else if (entry.url.includes('/product/')) type = 'product';
    
    report.statistics.urlTypes[type] = (report.statistics.urlTypes[type] || 0) + 1;
  });

  const reportPath = path.join(outputDir, 'sitemap-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log(`📊 Generated sitemap report: ${path.basename(reportPath)}`);
  console.log(`   - Images: ${report.statistics.imagesCount}, Mobile: ${report.statistics.mobilePages}, Geo: ${report.statistics.geoPages}`);
}
