import { promises as fs } from 'fs';
import { glob } from 'glob';

/**
 * Get all files matching the source patterns
 */
export async function getSourceFiles(patterns: string[]): Promise<string[]> {
  const allFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { ignore: ['node_modules/**', '.git/**'] });
    allFiles.push(...files);
  }
  
  return Array.from(new Set(allFiles));
}

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Read JSON file safely
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write JSON file
 */
export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}
