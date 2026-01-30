import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { readJsonFile, writeJsonFile, ensureDir } from '../utils/file-utils.js';

export function combineCommand(program: Command) {
  program
    .command('combine')
    .description('Combine multiple translation files into a single file')
    .argument('<pattern>', 'Glob pattern for translation files (e.g., "locales/*.json")')
    .option('--output <path>', 'Output file path', './combined-translations.json')
    .option('--format <format>', 'Output format: json, js, ts', 'json')
    .option('--namespace', 'Group translations by filename as namespace')
    .option('--merge-strategy <strategy>', 'Merge strategy for conflicts: overwrite, skip, prompt', 'overwrite')
    .action(async (pattern, options) => {
      const { output, format, namespace, mergeStrategy } = options;

      // Validate format
      const validFormats = ['json', 'js', 'ts'];
      if (!validFormats.includes(format)) {
        console.error(`❌ Invalid format. Valid options: ${validFormats.join(', ')}`);
        process.exit(1);
      }

      // Validate merge strategy
      const validStrategies = ['overwrite', 'skip', 'prompt'];
      if (!validStrategies.includes(mergeStrategy)) {
        console.error(`❌ Invalid merge strategy. Valid options: ${validStrategies.join(', ')}`);
        process.exit(1);
      }

      try {
        console.log('📦 Starting translation combination...');
        console.log(`🔍 Pattern: ${pattern}`);
        console.log(`📁 Output: ${output}`);
        console.log(`📄 Format: ${format}`);
        console.log(`🏷️  Namespace: ${namespace ? 'Yes' : 'No'}`);
        console.log(`🔄 Merge strategy: ${mergeStrategy}`);
        console.log('');

        // Import glob dynamically
        const { glob } = await import('glob');
        const files = await glob(pattern);

        if (files.length === 0) {
          console.error(`❌ No files found matching pattern: ${pattern}`);
          process.exit(1);
        }

        console.log(`📋 Found ${files.length} translation files:`);
        files.forEach(file => console.log(`   - ${file}`));
        console.log('');

        let combinedTranslations: Record<string, any> = {};
        let conflicts: Array<{file: string, key: string, existing: any, new: any}> = [];

        // Process each file
        for (const file of files) {
          console.log(`🔄 Processing: ${file}`);
          
          try {
            const translations = await readJsonFile<Record<string, any>>(file);
            
            if (!translations) {
              console.warn(`⚠️  Skipping ${file}: Could not read as JSON`);
              continue;
            }

            const filename = path.basename(file, path.extname(file));
            let sourceTranslations = translations;

            // Apply namespace if requested
            if (namespace) {
              sourceTranslations = { [filename]: translations };
            }

            // Merge translations
            for (const [key, value] of Object.entries(sourceTranslations)) {
              if (combinedTranslations.hasOwnProperty(key)) {
                // Handle conflict
                conflicts.push({
                  file,
                  key,
                  existing: combinedTranslations[key],
                  new: value
                });

                switch (mergeStrategy) {
                  case 'overwrite':
                    combinedTranslations[key] = value;
                    break;
                  case 'skip':
                    // Keep existing value
                    break;
                  case 'prompt':
                    // For now, default to overwrite in CLI
                    // In a real implementation, you could use inquirer for prompts
                    combinedTranslations[key] = value;
                    break;
                }
              } else {
                combinedTranslations[key] = value;
              }
            }

            console.log(`   ✅ Added ${Object.keys(sourceTranslations).length} keys`);

          } catch (error) {
            console.warn(`⚠️  Error processing ${file}:`, error);
          }
        }

        // Report conflicts
        if (conflicts.length > 0) {
          console.log('');
          console.log(`⚠️  Found ${conflicts.length} key conflicts:`);
          conflicts.forEach(conflict => {
            console.log(`   - "${conflict.key}" in ${conflict.file}`);
            console.log(`     Existing: ${JSON.stringify(conflict.existing)}`);
            console.log(`     New: ${JSON.stringify(conflict.new)}`);
            console.log(`     Resolution: ${mergeStrategy}`);
          });
        }

        // Ensure output directory exists
        const outputDir = path.dirname(output);
        await ensureDir(outputDir);

        // Generate output based on format
        let outputContent: string;
        let finalOutputPath = output;

        switch (format) {
          case 'json':
            outputContent = JSON.stringify(combinedTranslations, null, 2);
            if (!finalOutputPath.endsWith('.json')) {
              finalOutputPath += '.json';
            }
            break;

          case 'js':
            outputContent = `// Combined translations generated by Polygot\n`;
            outputContent += `// Generated on: ${new Date().toISOString()}\n\n`;
            outputContent += `module.exports = ${JSON.stringify(combinedTranslations, null, 2)};\n`;
            if (!finalOutputPath.endsWith('.js')) {
              finalOutputPath += '.js';
            }
            break;

          case 'ts':
            outputContent = `// Combined translations generated by Polygot\n`;
            outputContent += `// Generated on: ${new Date().toISOString()}\n\n`;
            outputContent += `export const translations = ${JSON.stringify(combinedTranslations, null, 2)} as const;\n\n`;
            outputContent += `export default translations;\n`;
            if (!finalOutputPath.endsWith('.ts')) {
              finalOutputPath += '.ts';
            }
            break;

          default:
            throw new Error(`Unsupported format: ${format}`);
        }

        // Write output file
        await fs.writeFile(finalOutputPath, outputContent, 'utf8');

        // Generate summary report
        const summaryPath = path.join(outputDir, 'combination-report.json');
        const summary = {
          timestamp: new Date().toISOString(),
          pattern,
          filesProcessed: files.length,
          totalKeys: Object.keys(combinedTranslations).length,
          conflicts: conflicts.length,
          mergeStrategy,
          namespace,
          outputFormat: format,
          outputFile: finalOutputPath,
          files: files.map(file => ({
            path: file,
            size: Object.keys(combinedTranslations).length // This is approximate
          }))
        };
        await writeJsonFile(summaryPath, summary);

        console.log('');
        console.log('✅ Translation combination completed successfully!');
        console.log(`📊 Summary:`);
        console.log(`   - Files processed: ${files.length}`);
        console.log(`   - Total keys: ${Object.keys(combinedTranslations).length}`);
        console.log(`   - Conflicts: ${conflicts.length}`);
        console.log(`   - Output format: ${format.toUpperCase()}`);
        console.log('');
        console.log(`📁 Files generated:`);
        console.log(`   - Combined translations: ${finalOutputPath}`);
        console.log(`   - Report: ${summaryPath}`);

      } catch (error) {
        console.error('❌ Translation combination failed:', error);
        process.exit(1);
      }
    });
}
