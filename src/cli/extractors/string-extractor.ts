import { promises as fs } from 'fs';
import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
import { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Children, ReactNode, isValidElement } from 'react';
import { 
  analyzeStringCharacteristics, 
  analyzePropertyContext, 
  isLikelyContent 
} from './analysis.js';

// Fix CJS/ESM interop
const traverse = (_traverse as any).default;

export const extractStrings = (elements: ReactNode): string[] => {
  const strings: string[] = [];
  const traverseElements = (els: ReactNode) => {
    Children.forEach(els, (child) => {
      if (typeof child === 'string' && child.trim() !== '') {
        strings.push(child);
      } else if (isValidElement(child)) {
        if (child.props && (child.props as any).children) {
          traverseElements((child.props as any).children);
        }
      }
    });
  };
  traverseElements(elements);
  return strings;
};

/**
 * Convert AST JSX structure to virtual ReactNode for domTraverse
 */
function astToVirtualReactNode(jsxElement: t.JSXElement): any {
  const openingElement = jsxElement.openingElement;
  const tagName = t.isJSXIdentifier(openingElement.name) ? openingElement.name.name : 'div';
  
  const props: any = {};
  openingElement.attributes.forEach(attr => {
    if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name)) {
      const attrName = attr.name.name;
      const contextScore = analyzePropertyContext(attrName);
      
      if (contextScore > 0 && attr.value) {
        if (t.isStringLiteral(attr.value)) {
          const value = attr.value.value;
          if (isLikelyContent(value)) {
            props[attrName] = value;
          }
        } else if (t.isJSXExpressionContainer(attr.value)) {
          const extracted = extractFromExpression(attr.value.expression as any);
          if (extracted && isLikelyContent(extracted)) {
            props[attrName] = extracted;
          }
        }
      }
    }
  });
  
  const children: any[] = [];
  jsxElement.children.forEach(child => {
    if (t.isJSXText(child)) {
      const text = child.value.trim();
      if (text && isLikelyContent(text)) {
        children.push(text);
      }
    } else if (t.isJSXElement(child)) {
      children.push(astToVirtualReactNode(child));
    } else if (t.isJSXExpressionContainer(child)) {
      const extracted = extractFromExpression(child.expression as any);
      if (extracted && isLikelyContent(extracted)) {
        children.push(extracted);
      }
    }
  });
  
  return {
    type: tagName,
    props: {
      ...props,
      children: children.length === 0 ? undefined : 
                children.length === 1 ? children[0] : children
    }
  };
}

/**
 * Extract string content from various expression types
 */
function extractFromExpression(expr: t.Expression): string | null {
  if (t.isStringLiteral(expr)) {
    return expr.value;
  } else if (t.isTemplateLiteral(expr)) {
    const parts: string[] = [];
    expr.quasis.forEach(quasi => {
      if (quasi.value.cooked) {
        parts.push(quasi.value.cooked);
      }
    });
    return parts.join('');
  }
  return null;
}

/**
 * Analyze array to determine content likelihood
 */
function analyzeArrayForContent(elements: t.StringLiteral[]): boolean {
  if (elements.length === 0) return false;
  
  let contentCount = 0;
  let totalCount = elements.length;
  
  elements.forEach(element => {
    if (isLikelyContent(element.value)) {
      contentCount++;
    }
  });
  
  return (contentCount / totalCount) > 0.6;
}

/**
 * Extract strings from data structures using logical analysis
 */
function extractStringsFromDataStructures(code: string): Set<string> {
  const strings = new Set<string>();
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    traverse(ast, {
      ObjectProperty(path: NodePath<t.ObjectProperty>) {
        if (t.isIdentifier(path.node.key)) {
          const keyName = path.node.key.name;
          const contextScore = analyzePropertyContext(keyName);
          
          if (contextScore > 0 && t.isStringLiteral(path.node.value)) {
            const value = path.node.value.value.trim();
            if (value && isLikelyContent(value)) {
              strings.add(value);
            }
          }
        }
      },

      ArrayExpression(path: NodePath<t.ArrayExpression>) {
        const stringElements = path.node.elements.filter(el => 
          t.isStringLiteral(el)
        ) as t.StringLiteral[];
        
        if (analyzeArrayForContent(stringElements)) {
          stringElements.forEach(element => {
            const value = element.value.trim();
            if (value && isLikelyContent(value)) {
              strings.add(value);
            }
          });
        }
      },

      StringLiteral(path: NodePath<t.StringLiteral>) {
        const value = path.node.value.trim();
        if (value && isLikelyContent(value)) {
          const parent = path.parent;
          if (t.isReturnStatement(parent) || 
              (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) && 
               analyzePropertyContext(parent.id.name) > 0)) {
            strings.add(value);
          }
        }
      },

      TemplateLiteral(path: NodePath<t.TemplateLiteral>) {
        const parts: string[] = [];
        path.node.quasis.forEach(quasi => {
          if (quasi.value.cooked) {
            parts.push(quasi.value.cooked);
          }
        });
        
        const fullText = parts.join('').trim();
        if (fullText && isLikelyContent(fullText)) {
          strings.add(fullText);
        }
      }
    });
    
  } catch (error) {
    console.warn(`Could not parse file for data structure extraction: ${error}`);
  }
  
  return strings;
}

/**
 * Main extraction function using pure logic
 */
export function extractStringsUsingDomTraverse(code: string): Set<string> {
  const allStrings = new Set<string>();
  
  const dataStrings = extractStringsFromDataStructures(code);
  dataStrings.forEach(str => allStrings.add(str));
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    traverse(ast, {
      JSXElement(path: NodePath<t.JSXElement>) {
        try {
          const virtualReactNode = astToVirtualReactNode(path.node);
          const extractedStrings = extractStrings(virtualReactNode);
          
          extractedStrings.forEach(str => {
            const trimmed = str.trim();
            if (trimmed && isLikelyContent(trimmed)) {
              allStrings.add(trimmed);
            }
          });
          
        } catch (error) {
          console.warn('Error processing JSX element with domTraverse:', error);
        }
      }
    });
    
  } catch (error) {
    console.warn(`Could not parse file for domTraverse extraction: ${(error as Error).message}`);
  }
  
  return allStrings;
}

/**
 * Extract strings from multiple files
 */
export async function extractAllStrings(files: string[]): Promise<Set<string>> {
  const allStrings = new Set<string>();
  
  console.log(`📝 Processing ${files.length} files for string extraction...`);
  
  for (const file of files) {
    try {
      const code = await fs.readFile(file, 'utf8');
      const fileStrings = extractStringsUsingDomTraverse(code);
      
      fileStrings.forEach(str => allStrings.add(str));
      
      if (fileStrings.size > 0) {
        console.log(`  - ${file}: ${fileStrings.size} strings`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not process ${file}: ${error}`);
    }
  }
  
  return allStrings;
}
