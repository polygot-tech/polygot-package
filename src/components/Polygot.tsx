import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { extractStrings, replaceStrings } from '../utils/domTraverse';
import { usePolygot } from '../hooks/usePolygot';

interface PolygotProps {
  children: ReactNode;
}

export const Polygot = ({ children }: PolygotProps) => {
  const { t, language } = usePolygot();

  const [translatedChildren, setTranslatedChildren] = useState<ReactNode | null>(null);

  const originalChildren = useMemo(() => children, [children]);

  useEffect(() => {
    if (language === 'en') { // Assuming 'en' is the source language
      setTranslatedChildren(originalChildren);
      return;
    }

    const stringsToTranslate: string[] = extractStrings(originalChildren);

    if (stringsToTranslate.length === 0) {
      setTranslatedChildren(originalChildren);
      return;
    }

    const translatedStrings = stringsToTranslate.map(s => t(s));

    const newChildren: ReactNode = replaceStrings(originalChildren, translatedStrings);
    setTranslatedChildren(newChildren);

  }, [originalChildren, language, t]);



  return <>{translatedChildren || originalChildren}</>;
};

interface NoPolygotProps {
  children: ReactNode;
}

export const NoPolygot = ({ children }: NoPolygotProps) => {
  return <>{children}</>;
};

NoPolygot.displayName = 'NoPolygot';