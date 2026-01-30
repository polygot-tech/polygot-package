import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';

export function bulkSEOCommand(program: Command) {
  program
    .command('seo-bulk')
    .description('Bulk SEO optimization for multiple pages/languages')
    .argument('<config>', 'Path to bulk SEO configuration JSON file')
    .requiredOption('--appid <appid>', 'Application ID for authentication')
    .option('--level <level>', 'Optimization level: basic, standard, advanced, enterprise', 'standard')
    .option('--concurrency <num>', 'Number of concurrent requests', '5')
    .option('--output <path>', 'Output directory for results', './bulk-seo-results')
    .action(async (configFile, options) => {
      const { appid, level, concurrency, output } = options;
      
      if (!appid) {
        console.error('❌ Error: --appid parameter is required');
        process.exit(1);
      }

      // Validate optimization level
      const validLevels = ['basic', 'standard', 'advanced', 'enterprise'];
      if (!validLevels.includes(level)) {
        console.error(`❌ Invalid optimization level. Valid options: ${validLevels.join(', ')}`);
        process.exit(1);
      }

      // Validate concurrency
      const concurrencyNum = parseInt(concurrency);
      if (isNaN(concurrencyNum) || concurrencyNum < 1 || concurrencyNum > 10) {
        console.error('❌ Concurrency must be between 1 and 10');
        process.exit(1);
      }

      try {
        console.log('🚀 Starting bulk SEO optimization...');
        console.log(`📂 Config file: ${configFile}`);
        console.log(`📊 Level: ${level.toUpperCase()}`);
        console.log(`⚡ Concurrency: ${concurrencyNum}`);
        console.log(`📁 Output: ${output}`);
        console.log('');

        // Read and validate configuration
        const configContent = await fs.readFile(configFile, 'utf8');
        const bulkConfig = JSON.parse(configContent);
        
        if (!bulkConfig.items || !Array.isArray(bulkConfig.items)) {
          throw new Error('Configuration must contain an "items" array');
        }

        if (bulkConfig.items.length === 0) {
          throw new Error('Items array cannot be empty');
        }

        if (bulkConfig.items.length > 100) {
          throw new Error('Maximum 100 items allowed per bulk request');
        }

        console.log(`📋 Processing ${bulkConfig.items.length} items...`);

        // Make bulk request to API
        const response = await fetch('http://localhost:3000/api/v1/translate/seo/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${appid}`
          },
          body: JSON.stringify({
            items: bulkConfig.items,
            globalSettings: {
              ...bulkConfig.globalSettings,
              optimization: {
                level: level,
                ...bulkConfig.globalSettings?.optimization
              }
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Bulk SEO API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(`Bulk SEO optimization failed: ${result.error}`);
        }

        // Ensure output directory exists
        await fs.mkdir(output, { recursive: true });

        // Save detailed results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsPath = path.join(output, `bulk-seo-results-${timestamp}.json`);
        await fs.writeFile(resultsPath, JSON.stringify(result.data, null, 2), 'utf8');

        // Save summary report
        const summaryPath = path.join(output, `bulk-seo-summary-${timestamp}.json`);
        const summary = {
          timestamp: new Date().toISOString(),
          optimizationLevel: level,
          concurrency: concurrencyNum,
          configFile,
          summary: result.data.summary,
          processingTime: result.metadata?.processingTime || 'Unknown',
          version: result.metadata?.version || '3.0.0'
        };
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

        // Generate individual files for successful optimizations
        if (result.data.results && result.data.results.length > 0) {
          const individualDir = path.join(output, 'individual-results');
          await fs.mkdir(individualDir, { recursive: true });

          for (let i = 0; i < result.data.results.length; i++) {
            const item = result.data.results[i];
            const itemPath = path.join(individualDir, `item-${i + 1}-${level}.json`);
            await fs.writeFile(itemPath, JSON.stringify(item, null, 2), 'utf8');
          }

          console.log(`📂 Individual results saved to: ${individualDir}`);
        }

        console.log('');
        console.log('✅ Bulk SEO optimization completed successfully!');
        console.log(`📊 Results Summary:`);
        console.log(`   - Total items: ${result.data.summary.total}`);
        console.log(`   - Successful: ${result.data.summary.successful}`);
        console.log(`   - Failed: ${result.data.summary.failed}`);
        console.log(`   - Success rate: ${((result.data.summary.successful / result.data.summary.total) * 100).toFixed(1)}%`);
        console.log('');
        console.log(`📁 Files generated:`);
        console.log(`   - Detailed results: ${resultsPath}`);
        console.log(`   - Summary report: ${summaryPath}`);

        if (result.data.summary.failed > 0) {
          console.log('');
          console.log('⚠️  Some items failed to optimize:');
          if (result.data.summary.errors) {
            result.data.summary.errors.forEach((error: any, index: number) => {
              console.log(`   ${index + 1}. Item ${error.index}: ${error.error}`);
            });
          }
        }

      } catch (error) {
        console.error('❌ Bulk SEO optimization failed:', error);
        
        // Try to save error details for debugging
        try {
          await fs.mkdir(output, { recursive: true });
          const errorPath = path.join(output, `error-${Date.now()}.json`);
          await fs.writeFile(errorPath, JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
            configFile,
            level,
            concurrency: concurrencyNum
          }, null, 2), 'utf8');
          console.log(`📁 Error details saved to: ${errorPath}`);
        } catch (saveError) {
          console.error('Failed to save error details:', saveError);
        }
        
        process.exit(1);
      }
    });
}
