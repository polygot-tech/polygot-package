import { Children, cloneElement, ReactNode, isValidElement } from 'react';
import { NoPolygot } from '../components/Polygot';

export const extractStrings = (elements: ReactNode): string[] => {
  const strings: string[] = [];
  const traverse = (els: ReactNode) => {
    Children.forEach(els, (child) => {
      if (typeof child === 'string' && child.trim() !== '') {
        strings.push(child);
      } else if (isValidElement(child)) {
        if (child.type === NoPolygot) {
          return;
        }
        if (child.props && (child.props as any).children) {
          traverse((child.props as any).children);
        }
      }
    });
  };
  traverse(elements);
  return strings;
};

export const replaceStrings = (elements: ReactNode, translatedStrings: string[]): ReactNode => {
  let translationIndex = 0;
  const rebuild = (els: ReactNode): ReactNode => {
    return Children.map(els, (child) => {
      if (typeof child === 'string' && child.trim() !== '') {
        return translatedStrings[translationIndex++] || child;
      }
      if (isValidElement(child)) {
        if (child.type === NoPolygot) {
          return child;
        }
        if (child.props && (child.props as any).children) {
          return cloneElement(child, { children: rebuild((child.props as any).children) } as any);
        }
      }
      return child;
    });
  };
  return rebuild(elements);
};

