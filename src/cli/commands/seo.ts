import { Command } from 'commander';
import { optimizeSEOContent } from '../core/seo.js';
import { SEOOptions } from '../types/index.js';

export function seoCommand(program: Command) {
  program
    .command('seo')
    .description('Optimize content for SEO in specified language')
    .argument('<config>', 'Path to content configuration JSON file')
    .argument('<language>', 'Target language for SEO optimization')
    .requiredOption('--appid <appid>', 'Application ID for authentication')
    .option('--region <region>', 'Target region for localization (e.g., US, UK, CA, FR)')
    .option('--industry <industry>', 'Industry/business type (e.g., Technology, Healthcare, Finance)')
    .option('--tone <tone>', 'Content tone: professional, casual, formal, friendly, academic, conversational, business, creative, technical, diplomatic, neutral', 'professional')
    .option('--keywords <keywords>', 'Target keywords (comma-separated)')
    .option('--title-max <number>', 'Maximum title length', '60')
    .option('--desc-max <number>', 'Maximum description length', '160')
    .action(async (configFile, language, options) => {
      const { appid, region, industry, tone, keywords, titleMax, descMax } = options;
      
      if (!appid) {
        console.error('❌ Error: --appid parameter is required');
        process.exit(1);
      }

      // Validate tone option
      const validTones = [
        'professional', 'casual', 'formal', 'friendly', 'academic',
        'conversational', 'business', 'creative', 'technical', 'diplomatic', 'neutral'
      ];
      
      if (!validTones.includes(tone)) {
        console.error(`❌ Invalid tone. Valid options: ${validTones.join(', ')}`);
        process.exit(1);
      }

      // Validate title and description lengths
      const titleMaxNum = parseInt(titleMax);
      const descMaxNum = parseInt(descMax);
      
      if (isNaN(titleMaxNum) || titleMaxNum < 30 || titleMaxNum > 120) {
        console.error('❌ Title max length must be between 30 and 120 characters');
        process.exit(1);
      }
      
      if (isNaN(descMaxNum) || descMaxNum < 120 || descMaxNum > 320) {
        console.error('❌ Description max length must be between 120 and 320 characters');
        process.exit(1);
      }

      try {
        console.log('🔍 Starting SEO optimization...');
        console.log(`📂 Content file: ${configFile}`);
        console.log(`🌍 Language: ${language.toUpperCase()}`);
        console.log(`🎨 Tone: ${tone}`);
        if (region) console.log(`📍 Region: ${region}`);
        if (industry) console.log(`🏢 Industry: ${industry}`);
        if (keywords) console.log(`🎯 Keywords: ${keywords}`);
        console.log(`📏 Title max: ${titleMaxNum} chars, Description max: ${descMaxNum} chars`);
        console.log('');

        const seoOptions: SEOOptions = {
          region,
          industry,
          tone,
          keywords,
          titleMax: titleMaxNum,
          descMax: descMaxNum
        };

        await optimizeSEOContent(configFile, language, appid, seoOptions);
        
        console.log('');
        console.log('🎉 SEO optimization completed successfully!');
        console.log('📁 Check the /locales directory for optimized content');

      } catch (error) {
        console.error('❌ SEO optimization failed:', error);
        process.exit(1);
      }
    });
}
