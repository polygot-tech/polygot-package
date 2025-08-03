/**
 * Analyze string characteristics using pure logic
 */
export function analyzeStringCharacteristics(str: string) {
  const length = str.length;
  const words = str.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Character type analysis
  const hasLetters = /[a-zA-Z]/.test(str);
  const hasNumbers = /\d/.test(str);
  const hasSpaces = str.includes(' ');
  const hasSpecialChars = /[^a-zA-Z0-9\s]/.test(str);
  const hasDashes = str.includes('-');
  const hasColons = str.includes(':');
  const hasSlashes = str.includes('/');
  const hasBrackets = /[\[\]{}()]/.test(str);
  
  // Capitalization patterns
  const startsWithCapital = /^[A-Z]/.test(str);
  const isAllCaps = str === str.toUpperCase() && hasLetters;
  const isMixedCase = str !== str.toLowerCase() && str !== str.toUpperCase();
  
  // Structure patterns
  const isUrl = str.includes('://') || (hasSlashes && str.includes('.'));
  const isPath = str.startsWith('./') || str.startsWith('../') || str.startsWith('/');
  const hasFileExtension = /\.[a-z]{2,4}$/i.test(str);
  
  // Length patterns
  const isVeryShort = length < 3;
  const isShort = length < 10;
  const isMedium = length >= 10 && length < 50;
  const isLong = length >= 50;
  
  return {
    length, wordCount, hasLetters, hasNumbers, hasSpaces, hasSpecialChars,
    hasDashes, hasColons, hasSlashes, hasBrackets, startsWithCapital,
    isAllCaps, isMixedCase, isUrl, isPath, hasFileExtension,
    isVeryShort, isShort, isMedium, isLong, words
  };
}

/**
 * Calculate semantic score - how likely is this to be meaningful content
 */
export function calculateSemanticScore(str: string, analysis: ReturnType<typeof analyzeStringCharacteristics>): number {
  let score = 0;
  
  // Positive indicators for content
  if (analysis.hasSpaces && analysis.wordCount > 1) score += 3;
  if (analysis.startsWithCapital && !analysis.isAllCaps) score += 1;
  if (analysis.isMedium) score += 2;
  if (analysis.isLong) score += 1;
  if (analysis.hasLetters && !analysis.hasNumbers) score += 1;
  if (analysis.wordCount > 2) score += 2;
  
  // Negative indicators for technical strings
  if (analysis.isVeryShort && !analysis.hasSpaces) score -= 2;
  if (analysis.isAllCaps && analysis.length > 1) score -= 2;
  if (analysis.isUrl || analysis.isPath) score -= 5;
  if (analysis.hasFileExtension) score -= 3;
  if (analysis.hasBrackets) score -= 2;
  
  // Special technical patterns
  if (analysis.hasColons && !analysis.hasSpaces) score -= 2;
  if (analysis.hasDashes && analysis.wordCount === 1 && analysis.hasNumbers) score -= 2;
  if (analysis.hasNumbers && analysis.length < 8 && !analysis.hasSpaces) score -= 1;
  
  return score;
}

/**
 * Calculate technical score - how likely is this to be technical/CSS content
 */
export function calculateTechnicalScore(str: string, analysis: ReturnType<typeof analyzeStringCharacteristics>): number {
  let score = 0;
  
  // Positive indicators for technical content
  if (analysis.hasDashes && !analysis.hasSpaces) score += 2;
  if (analysis.hasColons && !analysis.hasSpaces) score += 3;
  if (analysis.hasNumbers && analysis.hasDashes) score += 2;
  if (analysis.isVeryShort && !analysis.hasSpaces) score += 1;
  if (analysis.isAllCaps && analysis.length < 15) score += 2;
  if (analysis.hasSlashes && !analysis.hasSpaces) score += 2;
  
  // Multiple dash-separated parts (CSS classes)
  const dashParts = str.split('-');
  if (dashParts.length > 2 && !analysis.hasSpaces) score += 2;
  
  // Long concatenated strings without spaces
  if (analysis.isLong && !analysis.hasSpaces) score += 3;
  
  // Analyze individual words for technical patterns
  analysis.words.forEach(word => {
    const wordAnalysis = analyzeStringCharacteristics(word);
    if (wordAnalysis.hasDashes && wordAnalysis.hasNumbers) score += 1;
    if (wordAnalysis.hasColons) score += 2;
  });
  
  return score;
}

/**
 * Determine if string is likely content using logical analysis
 */
export function isLikelyContent(str: string): boolean {
  const analysis = analyzeStringCharacteristics(str);
  const semanticScore = calculateSemanticScore(str, analysis);
  const technicalScore = calculateTechnicalScore(str, analysis);
  
  return semanticScore > technicalScore && semanticScore > 0;
}

/**
 * Analyze context to determine if property/variable contains content
 */
export function analyzePropertyContext(name: string): number {
  const nameAnalysis = analyzeStringCharacteristics(name.toLowerCase());
  let score = 0;
  
  const nameWords = nameAnalysis.words;
  nameWords.forEach(word => {
    if (word.includes('text') || word.includes('title') || word.includes('content')) score += 3;
    if (word.includes('name') || word.includes('label') || word.includes('message')) score += 3;
    if (word.includes('description') || word.includes('excerpt') || word.includes('summary')) score += 3;
    if (word.includes('author') || word.includes('role') || word.includes('category')) score += 2;
    if (word.includes('caption') || word.includes('heading') || word.includes('genre')) score += 2;
    
    if (word.includes('style') || word.includes('class') || word.includes('css')) score -= 3;
    if (word.includes('config') || word.includes('setting') || word.includes('option')) score -= 2;
    if (word.includes('id') || word.includes('key') || word.includes('index')) score -= 2;
  });
  
  return score;
}
