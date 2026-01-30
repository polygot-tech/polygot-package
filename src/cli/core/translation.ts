import path from 'path';
import { PolygotConfig, TranslationOptions } from '../types/index.js';
import { getSourceFiles, ensureDir, readJsonFile, writeJsonFile } from '../utils/file-utils.js';
import { extractAllStrings } from '../extractors/string-extractor.js';
import { sleep } from '../utils/helpers.js';

const SOURCE_LANG = 'en';
const TRANSLATE_API_URL = 'http://localhost:3000/api/v1/translate';

/**
 * Enhanced getBulkTranslations to handle backend responses properly with retry logic
 */
async function getBulkTranslations(
  texts: string[], 
  targetLang: string, 
  appId: string,
  options: TranslationOptions = {}
): Promise<Record<string, string>> {
  
  // If we have a large number of texts, split them into chunks to avoid LLM parsing issues
  const CHUNK_SIZE = 30; // Reasonable chunk size to avoid parsing issues
  
  if (texts.length > CHUNK_SIZE) {
    console.log(`  - Large payload detected (${texts.length} strings), processing in chunks of ${CHUNK_SIZE}...`);
    
    const chunks = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      chunks.push(texts.slice(i, i + CHUNK_SIZE));
    }
    
    const allTranslations: Record<string, string> = {};
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`    - Processing chunk ${i + 1}/${chunks.length} (${chunk.length} strings)...`);
      
      try {
        const chunkTranslations = await getBulkTranslationsChunk(chunk, targetLang, appId, options);
        Object.assign(allTranslations, chunkTranslations);
        
        // Small delay between chunks
        if (i < chunks.length - 1) {
          await sleep(200);
        }
      } catch (error) {
        console.error(`    - Chunk ${i + 1} failed: ${error}`);
        // Add fallback for failed chunk
        chunk.forEach(text => {
          allTranslations[text] = text;
        });
      }
    }
    
    return allTranslations;
  } else {
    // Small payload, process directly
    return await getBulkTranslationsChunk(texts, targetLang, appId, options);
  }
}

/**
 * Process a single chunk of translations with retry logic
 */
async function getBulkTranslationsChunk(
  texts: string[], 
  targetLang: string, 
  appId: string,
  options: TranslationOptions = {}
): Promise<Record<string, string>> {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  - Attempt ${attempt}/${MAX_RETRIES}: Requesting translation for ${texts.length} string(s)...`);
      
      const requestBody: any = {
        to: targetLang,
        from: SOURCE_LANG,
        input: texts,
        ...options
      };
      
      const response = await fetch(TRANSLATE_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appId}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid API response format');
      }

      if (!result.success) {
        throw new Error(`API returned error: ${result.error || 'Unknown error'}`);
      }

      if (result.data === undefined || result.data === null) {
        throw new Error('API response missing data field');
      }

      // Process the translation data
      const translationMap = processTranslationResponse(result.data, texts);
      
      console.log(`✅ Successfully processed ${Object.keys(translationMap).length}/${texts.length} translations on attempt ${attempt}`);
      return translationMap;

    } catch (error) {
      lastError = error as Error;
      console.warn(`    - Attempt ${attempt} failed: ${error}`);
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff delay
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`    - Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  
  // All attempts failed, return fallback
  console.error(`❌ All ${MAX_RETRIES} attempts failed. Last error: ${lastError?.message}`);
  console.log(`⚠️ Using original texts as fallback`);
  
  return texts.reduce((acc, text) => {
    acc[text] = text;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Process the translation response data from your backend
 */
function processTranslationResponse(data: any, originalTexts: string[]): Record<string, string> {
  const translationMap: Record<string, string> = {};

  // Handle array response (most common for your backend)
  if (Array.isArray(data)) {
    if (data.length === originalTexts.length) {
      originalTexts.forEach((originalText, index) => {
        const translatedText = data[index];
        if (typeof translatedText === 'string' && translatedText.trim()) {
          translationMap[originalText] = translatedText;
        } else {
          translationMap[originalText] = originalText; // Fallback
        }
      });
      return translationMap;
    } else {
      console.warn(`Array length mismatch: expected ${originalTexts.length}, got ${data.length}`);
      // Map what we can
      originalTexts.forEach((originalText, index) => {
        if (index < data.length && typeof data[index] === 'string') {
          translationMap[originalText] = data[index];
        } else {
          translationMap[originalText] = originalText;
        }
      });
      return translationMap;
    }
  }

  // Handle object response
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    originalTexts.forEach(originalText => {
      if (data[originalText] && typeof data[originalText] === 'string') {
        translationMap[originalText] = data[originalText];
      } else {
        translationMap[originalText] = originalText; // Fallback
      }
    });
    return translationMap;
  }

  // Handle string response (fallback scenario from your backend)
  if (typeof data === 'string') {
    if (originalTexts.length === 1) {
      translationMap[originalTexts[0]] = data;
      return translationMap;
    } else {
      console.warn('Single string response for multiple texts - using originals');
      originalTexts.forEach(text => {
        translationMap[text] = text;
      });
      return translationMap;
    }
  }

  // Unexpected format
  console.warn(`Unexpected data format: ${typeof data} - using originals as fallback`);
  originalTexts.forEach(text => {
    translationMap[text] = text;
  });
  
  return translationMap;
}

/**
 * Perform translations based on config
 */
export async function performTranslations(config: PolygotConfig): Promise<any> {
  if (!config.translation.enabled) {
    console.log('📝 Translation disabled, skipping...');
    return null;
  }

  console.log('🚀 Starting translation process...');

  const sourceFiles = await getSourceFiles(config.translation.sources);
  console.log(`📂 Found ${sourceFiles.length} source files`);

  const allStrings = await extractAllStrings(sourceFiles);
  console.log(`🔤 Extracted ${allStrings.size} unique strings`);

  if (allStrings.size === 0) {
    console.log('✅ No translatable strings found');
    return { totalStrings: 0, languages: [] };
  }

  await ensureDir(config.translation.outputDir);

  const results = {
    totalStrings: allStrings.size,
    languages: config.translation.targetLanguages,
    translations: {} as Record<string, Record<string, string>>
  };

  for (const language of config.translation.targetLanguages) {
    console.log(`\n🌍 Translating to ${language.toUpperCase()}...`);
    
    const outputPath = path.join(config.translation.outputDir, `${language}.json`);
    const existingTranslations = await readJsonFile<Record<string, string>>(outputPath) || {};

    if (Object.keys(existingTranslations).length > 0) {
      console.log(`  - Found ${Object.keys(existingTranslations).length} existing translations`);
    } else {
      console.log(`  - Creating new translation file`);
    }

    const stringsToTranslate = Array.from(allStrings).filter(
      str => !existingTranslations[str]
    );

    if (stringsToTranslate.length === 0) {
      console.log(`  - ✅ All strings already translated for ${language}`);
      results.translations[language] = existingTranslations;
      continue;
    }

    console.log(`  - 🔄 Translating ${stringsToTranslate.length} new strings...`);

    try {
      const newTranslations = await getBulkTranslations(
        stringsToTranslate,
        language,
        config.api.appId,
        {
          tone: config.translation.tone,
          region: config.translation.region,
          context: config.translation.context
        }
      );
      
      const finalTranslations = { ...existingTranslations, ...newTranslations };
      results.translations[language] = finalTranslations;

      await writeJsonFile(outputPath, finalTranslations);
      console.log(`  - ✅ Saved ${Object.keys(finalTranslations).length} translations to ${outputPath}`);
      
    } catch (error) {
      console.error(`  - Translation failed for ${language}: ${error}`);
      // Use existing translations + original strings as fallback
      const fallbackTranslations = { ...existingTranslations };
      stringsToTranslate.forEach(text => {
        fallbackTranslations[text] = text;
      });
      results.translations[language] = fallbackTranslations;
      
      await writeJsonFile(outputPath, fallbackTranslations);
      console.log(`  - ⚠️ Saved fallback translations to ${outputPath}`);
    }

    await sleep(100); // Small delay between languages
  }

  return results;
}

/**
 * Individual translation function for backward compatibility
 */
export async function translateFiles(
  filePath: string,
  languages: string[],
  appId: string,
  options: TranslationOptions = {}
): Promise<void> {
  const sourceFilePath = path.join(process.cwd(), filePath);

  console.log(`▶️ Starting string extraction from: ${filePath}`);
  console.log(`  - Target languages: ${languages.join(', ').toUpperCase()}`);

  const allStrings = new Set<string>();
  try {
    const { promises: fs } = await import('fs');
    const code = await fs.readFile(sourceFilePath, 'utf8');
    const { extractStringsUsingDomTraverse } = await import('../extractors/string-extractor.js');
    const extractedStrings = extractStringsUsingDomTraverse(code);
    extractedStrings.forEach(str => allStrings.add(str));
  } catch (error) {
    console.error(`❌ Error reading file:`, error);
    process.exit(1);
  }
  
  if (allStrings.size === 0) {
    console.log("✅ No translatable strings found.");
    return;
  }
  
  console.log(`\nFound ${allStrings.size} unique translatable strings.`);

  const LOCALES_DIR = path.join(process.cwd(), 'locales');
  await ensureDir(LOCALES_DIR);

  for (const lang of languages) {
    console.log(`\n--- Processing language: ${lang.toUpperCase()} ---`);
    const targetFilePath = path.join(LOCALES_DIR, `${lang}.json`);
    const existingTranslations = await readJsonFile<Record<string, string>>(targetFilePath) || {};

    if (Object.keys(existingTranslations).length > 0) {
      console.log(`  - Found existing translations in ${lang}.json.`);
    } else {
      console.log(`  - No existing translation file for ${lang}.json. Creating new one.`);
    }

    const stringsToRequest = Array.from(allStrings).filter(
      (text) => !existingTranslations.hasOwnProperty(text)
    );

    if (stringsToRequest.length > 0) {
      const newTranslations = await getBulkTranslations(stringsToRequest, lang, appId, options);
      const finalTranslations = { ...existingTranslations, ...newTranslations };

      await writeJsonFile(targetFilePath, finalTranslations);
      console.log(`--- ✅ Successfully updated ${lang}.json with ${Object.keys(newTranslations).length} new translation(s) ---`);
    } else {
      console.log(`--- ✅ No new translations needed for ${lang}.json. File is up to date. ---`);
    }
    
    await sleep(100);
  }

  console.log("\n✨ All translations completed!");
}
