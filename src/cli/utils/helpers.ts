/**
 * A simple delay function to avoid hitting API rate limits.
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate completeness percentage
 */
export function calculateCompleteness(translations: Record<string, string>): number {
  const total = Object.keys(translations).length;
  if (total === 0) return 100;
  
  const completed = Object.values(translations).filter(val => val && val.trim() !== '').length;
  return Math.round((completed / total) * 100);
}

/**
 * Escape XML special characters
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
