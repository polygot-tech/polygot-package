import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { generateConfigTemplate } from '../core/config.js';

export function initCommand(program: Command) {
  program
    .command('init')
    .description('Initialize a new Polygot configuration file')
    .option('--format <format>', 'Configuration format: js, cjs, or json', 'js')
    .option('--force', 'Overwrite existing configuration file')
    .action(async (options) => {
      const { format, force } = options;
      
      if (!['js', 'cjs', 'json'].includes(format)) {
        console.error('❌ Invalid format. Use: js, cjs, or json');
        process.exit(1);
      }

      const configFileName = `config.polygot.${format}`;
      const configPath = path.join(process.cwd(), configFileName);

      try {
        // Check if config already exists
        await fs.access(configPath);
        if (!force) {
          console.error(`❌ Configuration file ${configFileName} already exists. Use --force to overwrite.`);
          process.exit(1);
        }
      } catch {
        // File doesn't exist, which is what we want
      }

      try {
        const templateConfig = generateConfigTemplate(format);
        await fs.writeFile(configPath, templateConfig, 'utf8');
        
        console.log('🎉 Polygot configuration initialized successfully!');
        console.log(`📁 Created: ${configFileName}`);
        console.log('');
        console.log('Next steps:');
        console.log('1. Edit the configuration file to match your project');
        console.log('2. Set your API key: export POLYGOT_APP_ID=your-actual-app-id');
        console.log('3. Run: polygot run');
        console.log('');
        console.log('Configuration features:');
        console.log('✅ Translation with string extraction');
        console.log('✅ Advanced SEO optimization with multiple levels');
        console.log('✅ Enhanced sitemap generation');
        console.log('✅ Business targeting and localization');
        console.log('✅ Performance and accessibility optimization');

      } catch (error) {
        console.error('❌ Failed to create configuration file:', error);
        process.exit(1);
      }
    });
}
