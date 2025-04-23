import { createContext, useContext } from 'react';

export const DominoContext = createContext({ runDominosFlow: () => {} });
export const useDomino = () => useContext(DominoContext);
