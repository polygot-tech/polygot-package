#!/usr/bin/env node

import { program } from 'commander';
import { runCommand } from './run.js';
import { initCommand } from './init.js';
import { translateCommand } from './translate.js';
import { combineCommand } from './combine.js';
import { seoCommand } from './seo.js';
import { bulkSEOCommand } from './seo-bulk.js';

// CLI Commands
program
  .name('polygot')
  .description('AI-powered translation and SEO automation tool')
  .version('2.0.0');

// Add all commands
runCommand(program);
initCommand(program);
translateCommand(program);
combineCommand(program);
seoCommand(program);
bulkSEOCommand(program);

if (process.argv.length <= 2) {
  program.help();
}

program.parse();
