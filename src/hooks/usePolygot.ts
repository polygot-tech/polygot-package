import React,{ useContext } from 'react';
import { PolygotContext, type PolygotContextType } from '../context/PolygotProvider';

 export const usePolygot = (): PolygotContextType => {
  const context = useContext(PolygotContext);

  if (!context) {
    throw new Error('usePolygot must be used within a PolygotProvider');
  }

  return context;
};