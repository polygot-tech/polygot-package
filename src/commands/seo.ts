#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// This fixes the CJS/ESM interop issue where the default export is nested.
const traverse = (_traverse as any).default;

// --- CONFIGURATION ---
const LOCALES_DIR = path.join(process.cwd(), 'locales');
const SOURCE_LANG = 'en'; // The source language of the text in your components
const TRANSLATE_API_URL = 'http://localhost:3000/api/v1/translate'; // The URL for your local Express translation endpoint

/**
 * A simple delay function to avoid hitting API rate limits.
 * @param {number} ms - The number of milliseconds to wait.
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts all user-facing strings from a given JavaScript/TypeScript code string.
 * @param {string} code - The source code from a .js, .jsx, or .tsx file.
 * @returns {Set<string>} A Set of unique strings found in the code.
 */
function extractStringsFromCode(code: string): Set<string> {
    const strings = new Set<string>();
    try {
        const ast = parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
        });

        traverse(ast, {
            JSXText(path: NodePath<t.JSXText>) {
                const value = path.node.value.trim();
                if (value) strings.add(value);
            },
            StringLiteral(path: NodePath<t.StringLiteral>) {
                if (t.isJSXAttribute(path.parent) || t.isJSXExpressionContainer(path.parent)) {
                    const value = path.node.value.trim();
                    if (value && !value.includes('/') && !value.includes('#') && value.length > 1) {
                       strings.add(value);
                    }
                }
            }
        });
    } catch (error) {
        console.warn(`Could not parse file: ${(error as Error).message}`);
    }
    return strings;
}

/**
 * Calls the local Express server to get translations for a batch of texts.
 * @param {string[]} texts - The array of texts to translate.
 * @param {string} targetLang - The target language code.
 * @returns {Promise<Record<string, string>>} A dictionary mapping original strings to their translations.
 */
async function getBulkTranslations(texts: string[], targetLang: string): Promise<Record<string, string>> {
    try {
        console.log(`  - Requesting translation for ${texts.length} new string(s)...`);
        const response = await fetch(TRANSLATE_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer plg1aVEz6iYHcgf3elrfZrE6hINOCmXh'
            },
            body: JSON.stringify({
                to: targetLang,
                from: SOURCE_LANG,
                input: texts // Send the entire array of strings
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Translation server returned status ${response.status}: ${errorText}`);
        }

        const result = await response.json();

        if (result.data) {
            // The server response is double-stringified, so we parse it.
            const translatedTexts = JSON.parse(result.data);

            // **FIX:** Ensure the response is an array, then map original texts to translated texts.
            if (Array.isArray(translatedTexts) && translatedTexts.length === texts.length) {
                const translationMap: Record<string, string> = {};
                texts.forEach((originalText, index) => {
                    translationMap[originalText] = translatedTexts[index];
                });
                return translationMap;
            } else {
                 throw new Error('Mismatched translation response. Expected an array of the same length as the input.');
            }
        }
        return {}; // Return empty object if no data
    } catch (error) {
        console.error(`Failed to get bulk translations:`, error);
        // On error, return an object that maps each text to itself to avoid breaking the process
        return texts.reduce((acc, text) => {
            acc[text] = text;
            return acc;
        }, {} as Record<string, string>);
    }
}

/**
 * Main function to find files, extract strings, and generate translations.
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error("❌ Error: Missing arguments.");
        console.log("Usage: polyglot-translate <path/to/yourFile.jsx> <lang1,lang2,...>");
        process.exit(1);
    }

    const sourceFileName = args[0];
    const targetLangs = args[1].split(',');
    const sourceFilePath = path.join(process.cwd(), sourceFileName);

    console.log(`▶️ Starting string extraction from: ${sourceFileName}`);
    console.log(`  - Target languages: ${targetLangs.join(', ').toUpperCase()}`);

    const allStrings = new Set<string>();
    try {
        const code = await fs.readFile(sourceFilePath, 'utf8');
        extractStringsFromCode(code).forEach(str => allStrings.add(str));
        console.log(`  - Successfully processed file.`);
    } catch (error) {
        console.error(`❌ Error reading file:`, error);
        process.exit(1);
    }
    
    if (allStrings.size === 0) {
        console.log("✅ No strings found to translate. Exiting.");
        return;
    }
    console.log(`\nFound ${allStrings.size} unique strings to check.`);

    for (const lang of targetLangs) {
        console.log(`\n--- Processing language: ${lang.toUpperCase()} ---`);
        const targetFilePath = path.join(LOCALES_DIR, `${lang}.json`);
        let existingTranslations: { [key: string]: string } = {};

        try {
            const existingContent = await fs.readFile(targetFilePath, 'utf8');
            existingTranslations = JSON.parse(existingContent);
            console.log(`  - Found existing translations in ${lang}.json.`);
        } catch {
            console.log(`  - No existing translation file for ${lang}.json. Creating new one.`);
        }

        // Determine which strings are new and need to be translated.
        const stringsToRequest = Array.from(allStrings).filter(
            (text) => !existingTranslations.hasOwnProperty(text)
        );

        if (stringsToRequest.length > 0) {
            // Get all new translations in a single API call
            const newTranslations = await getBulkTranslations(stringsToRequest, lang);
            
            // Merge the new translations with the existing ones
            const finalTranslations = { ...existingTranslations, ...newTranslations };

            await fs.mkdir(LOCALES_DIR, { recursive: true });
            await fs.writeFile(targetFilePath, JSON.stringify(finalTranslations, null, 2), 'utf8');
            console.log(`--- ✅ Successfully updated ${lang}.json with ${Object.keys(newTranslations).length} new translation(s) ---`);
        } else {
            console.log(`--- ✅ No new translations needed for ${lang}.json. File is up to date. ---`);
        }
    }

    console.log("\n✨ All translations generated successfully!");
}

main().catch(error => {
    console.error("❌ An unexpected error occurred:", error);
    process.exit(1);
});
