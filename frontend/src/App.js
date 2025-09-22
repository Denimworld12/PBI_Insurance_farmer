import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ClaimProvider } from './contexts/ClaimContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClaimForm from './pages/ClaimForm';
import MediaCapture from './pages/MediaCapture';
import ClaimsList from './pages/ClaimsList';
import ClaimResults from './pages/ClaimResults';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <ClaimProvider>
        <Router>
          <div className="App">
            <Header />
            <main className="main-content">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />

                {/* Protected routes */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/claims"
                  element={
                    <ProtectedRoute>
                      <ClaimsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/claim-form/:insuranceId"
                  element={
                    <ProtectedRoute>
                      <ClaimForm />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/media-capture/:documentId"
                  element={
                    <ProtectedRoute>
                      <MediaCapture />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/claim-results/:documentId"
                  element={
                    <ProtectedRoute>
                      <ClaimResults />
                    </ProtectedRoute>
                  }
                />

                {/* Redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </ClaimProvider>
    </AuthProvider>
  );
}

export default App;
