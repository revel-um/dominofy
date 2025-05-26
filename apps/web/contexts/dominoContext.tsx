import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';

interface DominoContextType {
  erroredNodes: string[];
  setConnectionErrors: (ids: string[]) => void;
  setValidationErrors: (ids: string[]) => void;
  clearConnectionErrors: () => void;
  clearValidationForDominoId: (id: string) => void;
}

export const DominoContext = createContext<DominoContextType>({
  erroredNodes: [],
  setConnectionErrors: () => {},
  setValidationErrors: () => {},
  clearConnectionErrors: () => {},
  clearValidationForDominoId: () => {},
});

export const useDomino = () => useContext(DominoContext);

export const DominoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectionErrors, setConnectionErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Union of connection and validation errors
  const erroredNodes = useMemo(
    () => Array.from(new Set([...connectionErrors, ...validationErrors])),
    [connectionErrors, validationErrors]
  );

  // Clears all connection errors
  const clearConnectionErrors = () => setConnectionErrors([]);
  // Clears validation error for a specific node
  const clearValidationForDominoId = (id: string) =>
    setValidationErrors(prev => prev.filter(errId => errId !== id));

  // Your existing run logic should call setValidationErrors internally
  const runDominosFlow = () => {
    // ... invoke pipeline and setValidationErrors(...)
  };

  const contextValue: DominoContextType = {
    erroredNodes,
    setConnectionErrors,
    setValidationErrors,
    clearConnectionErrors,
    clearValidationForDominoId,
  };

  return (
    <DominoContext.Provider value={contextValue}>
      {children}
    </DominoContext.Provider>
  );
};
