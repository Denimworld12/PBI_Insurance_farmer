import React, { createContext, useContext, useState, useReducer, useCallback } from 'react';

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

  // ✅ Memoized functions to prevent unnecessary re-renders
  const setSelectedInsurance = useCallback((insurance) => {
    dispatch({ type: 'SET_INSURANCE', payload: insurance });
  }, []);

  const updateFormData = useCallback((data) => {
    dispatch({ type: 'SET_FORM_DATA', payload: data });
  }, []);

  const generateDocumentId = useCallback(() => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    const documentId = `CLM-${timestamp}-${random}`.toUpperCase();
    
    dispatch({ type: 'SET_DOCUMENT_ID', payload: documentId });
    console.log('✅ Generated Document ID:', documentId);
    
    return documentId;
  }, []);

  const addCapturedMedia = useCallback((stepId, mediaData) => {
    dispatch({ type: 'ADD_MEDIA', stepId, payload: mediaData });
    console.log(`✅ Media captured for step: ${stepId}`);
  }, []);

  const setProcessingResult = useCallback((result) => {
    dispatch({ type: 'SET_PROCESSING_RESULT', payload: result });
    console.log('✅ Processing result updated');
  }, []);

  const resetClaim = useCallback(() => {
    dispatch({ type: 'RESET_CLAIM' });
    console.log('✅ Claim state reset');
  }, []);

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
