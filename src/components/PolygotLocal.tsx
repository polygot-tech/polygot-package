import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { extractStrings, replaceStrings } from '../utils/domTraverse';
import { usePolygot } from '../hooks/usePolygot';
import { LanguageCodes } from '../types/Language';

/**
 * @interface PolygotLocalProps
 * @property {ReactNode} children - The React nodes to be translated.
 * @property {Record<LanguageCodes, Record<string, string>>} translationJson - A JSON object containing translations.
 * The structure should be: { "languageCode": { "original text": "translated text" } }
 * e.g. { "es": { "Hello": "Hola" } }
 */
interface PolygotLocalProps {
  children: ReactNode;
  translationJson: Record<string, Record<string, string>>;
}

/**
 * PolygotLocal is a component that translates its children based on a provided JSON object.
 * It listens for language changes from the PolygotContext and applies the appropriate translations.
 *
 * @param {PolygotLocalProps} props - The props for the component.
 * @returns {React.FC} - A React component that renders translated children.
 */
export const PolygotLocal: React.FC<PolygotLocalProps> = ({ children, translationJson }) => {
  // Use the usePolygot hook to get the current language from the context.
  const { language } = usePolygot();

  // State to hold the translated children.
  const [translatedChildren, setTranslatedChildren] = useState<ReactNode | null>(null);

  // Memoize the original children to prevent unnecessary re-renders.
  const originalChildren = useMemo(() => children, [children]);

  useEffect(() => {
    // If there's no translation JSON, or no translations for the current language,
    // render the original children.
    const translationsForLanguage = translationJson?.[language as LanguageCodes];
    if (!translationsForLanguage) {
      setTranslatedChildren(originalChildren);
      return;
    }

    // Extract all translatable strings from the children nodes.
    const stringsToTranslate: string[] = extractStrings(originalChildren);

    // If there are no strings to translate, render the original children.
    if (stringsToTranslate.length === 0) {
      setTranslatedChildren(originalChildren);
      return;
    }

    // Map over the extracted strings and find their translations in the JSON object.
    // If a translation is not found, it defaults to the original string.
    const translatedStrings = stringsToTranslate.map(s => translationsForLanguage[s] || s);

    // Replace the original strings in the children with the translated strings.
    const newChildren: ReactNode = replaceStrings(originalChildren, translatedStrings);
    setTranslatedChildren(newChildren);

  }, [originalChildren, language, translationJson]);

  // Render the translated children if available, otherwise render the original children.
  return <>{translatedChildren || originalChildren}</>;
};
