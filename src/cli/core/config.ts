import { promises as fs } from 'fs';
import path from 'path';
import { PolygotConfig } from '../types/index.js';

/**
 * Load configuration from config.polygot files
 */
export async function loadConfig(configPath?: string): Promise<PolygotConfig> {
  const defaultConfigPaths = [
    path.join(process.cwd(), 'config.polygot.js'),
    path.join(process.cwd(), 'config.polygot.cjs'),
    path.join(process.cwd(), 'config.polygot.json')
  ];
  
  let finalConfigPath = configPath;
  
  if (!configPath) {
    for (const testPath of defaultConfigPaths) {
      try {
        await fs.access(testPath);
        finalConfigPath = testPath;
        break;
      } catch {
        continue;
      }
    }
  }
  
  if (!finalConfigPath) {
    throw new Error('No config.polygot.js, config.polygot.cjs, or config.polygot.json found in current directory');
  }

  try {
    await fs.access(finalConfigPath);
    
    let config: PolygotConfig;
    const fileExtension = path.extname(finalConfigPath);
    const absolutePath = path.resolve(finalConfigPath);
    
    if (fileExtension === '.json') {
      const content = await fs.readFile(finalConfigPath, 'utf8');
      config = JSON.parse(content);
    } else if (fileExtension === '.js' || fileExtension === '.cjs') {
      const fileUrl = `file://${absolutePath}?t=${Date.now()}`;
      const configModule = await import(fileUrl);
      config = configModule.default || configModule;
      
      if (config && typeof config === 'object' && !config.api && !config.translation && !config.seo) {
        const possibleConfig = Object.values(config).find(
          (val: any) => val && typeof val === 'object' && (val.api || val.translation || val.seo)
        );
        if (possibleConfig) {
          config = possibleConfig as PolygotConfig;
        }
      }
    } else {
      throw new Error(`Unsupported config file extension: ${fileExtension}`);
    }
    
    console.log(`📋 Configuration loaded from: ${finalConfigPath}`);
    return config;
    
  } catch (error) {
    throw new Error(`Failed to load configuration from ${finalConfigPath}. Error: ${(error as Error).message}`);
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: PolygotConfig): void {
  if (!config.api?.appId) {
    throw new Error('API configuration is required. Please set api.appId in your config.');
  }

  if (!config.api.appId.trim() || config.api.appId === 'your-app-id' || config.api.appId === 'your-app-id-here') {
    throw new Error('Please set a valid api.appId in your config (current value appears to be a placeholder).');
  }

  if (config.translation?.enabled && !config.translation.targetLanguages?.length) {
    throw new Error('Translation is enabled but no target languages specified.');
  }

  if (config.seo?.enabled && !config.seo.languages?.length) {
    throw new Error('SEO is enabled but no languages specified.');
  }
}

/**
 * Generate config templates
 */
export function generateConfigTemplate(format: 'js' | 'cjs' | 'json'): string {
  const configData = {
    api: {
      appId: "your-app-id-here"
    },
    translation: {
      enabled: true,
      sourceLanguage: "en",
      targetLanguages: ["fr", "es", "de"],
      tone: "professional",
      sources: ["src/**/*.{js,jsx,ts,tsx}"],
      outputDir: "locales",
      options: {
        preserveWhitespace: true,
        skipTechnicalStrings: true
      }
    },
    seo: {
      enabled: true,
      languages: ["en", "fr", "es", "de"],
      content: {
        pages: {
          "/": {
            title: "Your App Title",
            description: "Your app description",
            keywords: ["keyword1", "keyword2"],
            industry: "Technology"
          }
        },
        global: {
          siteName: "Your App",
          author: "Your Team",
          twitterHandle: "@yourapp",
          defaultImage: "/og-image.jpg",
          canonicalUrl: "https://yourapp.com"
        }
      },
      optimization: {
        level: "standard",
        titleMaxLength: 60,
        descriptionMaxLength: 160,
        keywordDensity: 1.5,
        includeLocalSEO: false,
        socialMedia: true,
        structuredData: true,
        generateSitemap: true,
        includeImages: true,
        includeMobile: true,
        generateRobotsTxt: true,
        mobileOptimized: true,
        accessibilityCompliant: true,
        performanceOptimized: true
      },
      outputDir: "seo"
    },
    businessInfo: {
      name: "Your Business Name",
      type: "other",
      location: {
        city: "Your City",
        country: "Your Country"
      }
    },
    targetAudience: {
      age: "25-45",
      interests: ["technology", "productivity"]
    }
  };

  if (format === 'json') {
    return JSON.stringify(configData, null, 2);
  } else {
    return `// config.polygot.${format} - Enhanced Polygot Configuration
module.exports = {
  api: {
    appId: process.env.POLYGOT_APP_ID || "your-app-id-here"
  },

  translation: {
    enabled: true,
    sourceLanguage: "en",
    targetLanguages: ["fr", "es", "de"],
    tone: "professional",
    sources: [
      "src/**/*.{js,jsx,ts,tsx}"
    ],
    outputDir: "locales",
    options: {
      preserveWhitespace: true,
      skipTechnicalStrings: true
    }
  },

  seo: {
    enabled: true,
    languages: ["en", "fr", "es", "de"],
    content: {
      pages: {
        "/": {
          title: "Your App Title",
          description: "Your app description",
          keywords: ["keyword1", "keyword2"],
          industry: "Technology"
        }
      },
      global: {
        siteName: "Your App",
        author: "Your Team",
        twitterHandle: "@yourapp",
        defaultImage: "/og-image.jpg",
        canonicalUrl: "https://yourapp.com"
      }
    },
    optimization: {
      level: "standard", // basic, standard, advanced, enterprise
      titleMaxLength: 60,
      descriptionMaxLength: 160,
      keywordDensity: 1.5,
      includeLocalSEO: false,
      socialMedia: true,
      structuredData: true,
      generateSitemap: true,
      // Enhanced sitemap options
      includeImages: true,
      includeMobile: true,
      generateRobotsTxt: true,
      // Performance and accessibility
      mobileOptimized: true,
      accessibilityCompliant: true,
      performanceOptimized: true
    },
    outputDir: "seo"
  },

  // Enhanced business information for better SEO
  businessInfo: {
    name: "Your Business Name",
    type: "other", // ecommerce, blog, corporate, saas, etc.
    location: {
      city: "Your City",
      country: "Your Country"
    }
  },

  // Target audience for better optimization
  targetAudience: {
    age: "25-45",
    interests: ["technology", "productivity"]
  }
};`;
  }
}
