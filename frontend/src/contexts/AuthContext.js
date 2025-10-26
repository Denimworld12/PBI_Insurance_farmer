import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ✅ Initialize auth state from localStorage on mount
        const initializeAuth = () => {
            try {
                const token = localStorage.getItem('authToken');
                const userData = localStorage.getItem('userData');

                if (token && userData) {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);
                    setIsAuthenticated(true);
                    console.log('✅ User session restored:', parsedUser.phoneNumber);
                } else {
                    console.log('ℹ️ No active session found');
                }
            } catch (error) {
                console.error('❌ Failed to restore session:', error);
                // Clear corrupted data
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // ✅ Memoized login function
    const login = useCallback((token, userData) => {
        try {
            localStorage.setItem('authToken', token);
            localStorage.setItem('userData', JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            console.log('✅ User logged in:', userData.phoneNumber);
        } catch (error) {
            console.error('❌ Failed to save login data:', error);
            throw new Error('Failed to save session data');
        }
    }, []);

    // ✅ Memoized logout function
    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        setUser(null);
        setIsAuthenticated(false);
        console.log('✅ User logged out');
    }, []);

    // ✅ Memoized getToken function
    const getToken = useCallback(() => {
        return localStorage.getItem('authToken');
    }, []);

    // ✅ Additional helper: Check if token exists
    const hasToken = useCallback(() => {
        return !!localStorage.getItem('authToken');
    }, []);

    // ✅ Additional helper: Update user data
    const updateUser = useCallback((updatedData) => {
        try {
            const newUserData = { ...user, ...updatedData };
            localStorage.setItem('userData', JSON.stringify(newUserData));
            setUser(newUserData);
            console.log('✅ User data updated');
        } catch (error) {
            console.error('❌ Failed to update user data:', error);
        }
    }, [user]);

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        getToken,
        hasToken,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
