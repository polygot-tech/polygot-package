import { Command } from 'commander';
import { loadConfig, validateConfig } from '../core/config.js';
import { performTranslations } from '../core/translation.js';
import { performSEOOptimization } from '../core/seo.js';

export function runCommand(program: Command) {
  program
    .command('run')
    .description('Run complete Polygot automation based on config.polygot.js')
    .option('--config <path>', 'Path to configuration file (default: ./config.polygot.js)')
    .option('--dry-run', 'Show what would be done without actually doing it')
    .action(async (options) => {
      if (options.dryRun) {
        console.log('🔍 Dry run mode - showing configuration...');
        try {
          const config = await loadConfig(options.config);
          console.log('\nConfiguration:');
          console.log(JSON.stringify(config, null, 2));
        } catch (error) {
          console.error('❌ Configuration error:', error);
          process.exit(1);
        }
        return;
      }
      
      await runPolygotAutomation(options.config);
    });
}

async function runPolygotAutomation(configPath?: string): Promise<void> {
  try {
    console.log('🚀 Starting Polygot automation...\n');
    
    const config = await loadConfig(configPath);
    validateConfig(config);
    
    console.log(`📋 Configuration loaded successfully`);
    console.log(`  - Translation: ${config.translation?.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  - SEO: ${config.seo?.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    
    const results: any = {
      translation: null,
      seo: null,
      startTime: Date.now(),
      endTime: 0,
      totalTime: 0
    };
    
    results.translation = await performTranslations(config);
    results.seo = await performSEOOptimization(config);
    
    results.endTime = Date.now();
    results.totalTime = results.endTime - results.startTime;
    
    console.log('\n🎉 Polygot automation completed successfully!');
    console.log(`⏱️  Total time: ${(results.totalTime / 1000).toFixed(2)}s`);
    
    if (results.translation) {
      console.log(`📝 Translation: ${results.translation.totalStrings} strings → ${results.translation.languages.length} languages`);
    }
    
    if (results.seo) {
      console.log(`🔍 SEO: ${results.seo.pages.length} pages → ${results.seo.languages.length} languages`);
    }
    
  } catch (error) {
    console.error('\n❌ Polygot automation failed:', error);
    process.exit(1);
  }
}
