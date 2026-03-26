import React, { createContext, useContext, ReactNode, useState, useMemo } from 'react';
import { NodeErrorMap } from '../helpers/errorDetector';

type ErrorInput = string[] | NodeErrorMap;

const normalizeErrors = (errors: ErrorInput): NodeErrorMap =>
  Array.isArray(errors)
    ? Object.fromEntries(errors.map(id => [id, 'This node has a validation error.']))
    : errors;

export interface DominoContextType {
  erroredNodes: string[];
  setConnectionErrors: (errors: ErrorInput) => void;
  setValidationErrors: (errors: ErrorInput) => void;
  clearConnectionErrors: () => void;
  clearValidationForDominoId: (id: string) => void;
  getNodeErrorMessage: (id: string) => string | undefined;
}

export const DominoContext = createContext<DominoContextType>({
  erroredNodes: [],
  setConnectionErrors: () => {},
  setValidationErrors: () => {},
  clearConnectionErrors: () => {},
  clearValidationForDominoId: () => {},
  getNodeErrorMessage: () => undefined,
});

export const useDomino = () => useContext(DominoContext);

export const DominoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectionErrors, setConnectionErrorsState] = useState<NodeErrorMap>({});
  const [validationErrors, setValidationErrorsState] = useState<NodeErrorMap>({});

  // Union of connection and validation errors
  const erroredNodes = useMemo(
    () => Array.from(new Set([...Object.keys(connectionErrors), ...Object.keys(validationErrors)])),
    [connectionErrors, validationErrors]
  );

  const setConnectionErrors = (errors: ErrorInput) => setConnectionErrorsState(normalizeErrors(errors));
  const setValidationErrors = (errors: ErrorInput) => setValidationErrorsState(normalizeErrors(errors));

  // Clears all connection errors
  const clearConnectionErrors = () => setConnectionErrorsState({});
  // Clears validation error for a specific node
  const clearValidationForDominoId = (id: string) =>
    setValidationErrorsState(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const getNodeErrorMessage = (id: string) => validationErrors[id] ?? connectionErrors[id];

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
    getNodeErrorMessage,
  };

  return (
    <DominoContext.Provider value={contextValue}>
      {children}
    </DominoContext.Provider>
  );
};
