import { Command } from 'commander';
import { translateFiles } from '../core/translation.js';
import { TranslationOptions } from '../types/index.js';

export function translateCommand(program: Command) {
  program
    .command('translate')
    .description('Extract and translate strings from source files')
    .argument('<file>', 'Source file to extract strings from')
    .argument('<languages>', 'Target languages (comma-separated, e.g., "fr,es,de")')
    .requiredOption('--appid <appid>', 'Application ID for authentication')
    .option('--tone <tone>', 'Translation tone: professional, casual, formal, friendly, academic, conversational, business, creative, technical, diplomatic, neutral', 'professional')
    .option('--region <region>', 'Target region for localization (e.g., US, UK, CA)')
    .option('--context <context>', 'Additional context for translation')
    .action(async (file, languages, options) => {
      const { appid, tone, region, context } = options;
      
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

      // Parse languages
      const targetLanguages = languages.split(',').map((lang: string) => lang.trim());
      
      if (targetLanguages.length === 0) {
        console.error('❌ Error: At least one target language is required');
        process.exit(1);
      }

      try {
        console.log('🚀 Starting translation process...');
        console.log(`📂 Source file: ${file}`);
        console.log(`🎯 Target languages: ${targetLanguages.join(', ').toUpperCase()}`);
        console.log(`🎨 Tone: ${tone}`);
        if (region) console.log(`🌍 Region: ${region}`);
        if (context) console.log(`📝 Context: ${context}`);
        console.log('');

        const translationOptions: TranslationOptions = {
          tone,
          region,
          context
        };

        await translateFiles(file, targetLanguages, appid, translationOptions);
        
        console.log('');
        console.log('🎉 Translation process completed successfully!');
        console.log('📁 Check the /locales directory for translation files');

      } catch (error) {
        console.error('❌ Translation failed:', error);
        process.exit(1);
      }
    });
}
