const translationCache = new Map();

export const fetchTranslations = async (
  stringsToTranslate: object,
  sourceLang: string,
  targetLang: string,
  apiKey: string
) => {
  const cacheKey = `${sourceLang}-${targetLang}:${JSON.stringify(
    stringsToTranslate
  )}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const response = await fetch(
    "https://terrific-freedom-production.up.railway.app/api/v1/translate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: targetLang,
        from: sourceLang,
        input: stringsToTranslate,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `API request failed with status ${response.status}: ${errorBody}`
    );
  }

  const result = await response.json();

  if (result) {
    const parsedResponse = JSON.parse(result.data);
    translationCache.set(cacheKey, parsedResponse);
    return parsedResponse;
  } else {
    throw new Error("Invalid response format from translation API.");
  }
};
