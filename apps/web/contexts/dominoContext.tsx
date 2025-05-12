import { createContext, useContext } from 'react';

interface DominoContextType {
  runDominosFlow: () => void;
  erroredNodes: string[];
}

export const DominoContext = createContext<DominoContextType>({
  runDominosFlow: () => {},
  erroredNodes: [],
});

export const useDomino = () => useContext(DominoContext);
