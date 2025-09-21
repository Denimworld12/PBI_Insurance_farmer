import React, { createContext, useContext, useState, useReducer } from 'react';

const ClaimContext = createContext();

export const useClaim = () => {
  const context = useContext(ClaimContext);
  if (!context) {
    throw new Error('useClaim must be used within a ClaimProvider');
  }
  return context;
};

const claimReducer = (state, action) => {
  switch (action.type) {
    case 'SET_INSURANCE':
      return { ...state, selectedInsurance: action.payload };
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } };
    case 'SET_DOCUMENT_ID':
      return { ...state, documentId: action.payload };
    case 'ADD_MEDIA':
      return { 
        ...state, 
        capturedMedia: { ...state.capturedMedia, [action.stepId]: action.payload } 
      };
    case 'SET_PROCESSING_RESULT':
      return { ...state, processingResult: action.payload };
    case 'RESET_CLAIM':
      return initialState;
    default:
      return state;
  }
};

const initialState = {
  selectedInsurance: null,
  formData: {
    state: '',
    season: '',
    scheme: '',
    year: new Date().getFullYear(),
    insuranceNumber: '',
    cropType: '',
    farmArea: '',
    lossReason: '',
    lossDescription: ''
  },
  documentId: null,
  capturedMedia: {},
  processingResult: null
};

export const ClaimProvider = ({ children }) => {
  const [claimState, dispatch] = useReducer(claimReducer, initialState);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);

  const setSelectedInsurance = (insurance) => {
    dispatch({ type: 'SET_INSURANCE', payload: insurance });
  };

  const updateFormData = (data) => {
    dispatch({ type: 'SET_FORM_DATA', payload: data });
  };

  const generateDocumentId = () => {
    const numbers = Math.floor(10000000 + Math.random() * 90000000);
    const letters = Math.random().toString(36).substring(2, 4).toUpperCase();
    const documentId = numbers + letters;
    dispatch({ type: 'SET_DOCUMENT_ID', payload: documentId });
    return documentId;
  };

  const addCapturedMedia = (stepId, mediaData) => {
    dispatch({ type: 'ADD_MEDIA', stepId, payload: mediaData });
  };

  const setProcessingResult = (result) => {
    dispatch({ type: 'SET_PROCESSING_RESULT', payload: result });
  };

  const resetClaim = () => {
    dispatch({ type: 'RESET_CLAIM' });
  };

  const value = {
    claimState,
    claims,
    loading,
    setLoading,
    setClaims,
    setSelectedInsurance,
    updateFormData,
    generateDocumentId,
    addCapturedMedia,
    setProcessingResult,
    resetClaim
  };

  return (
    <ClaimContext.Provider value={value}>
      {children}
    </ClaimContext.Provider>
  );
};
