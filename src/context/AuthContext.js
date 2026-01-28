
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token') || sessionStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Hydrate user from token logic
        const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
        const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

        if (storedToken) {
            setToken(storedToken);
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password, rememberMe) => {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            setToken(data.token);
            setUser(data.user);
            if (rememberMe) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            } else {
                // Session storage or just state? User asked for "Keep me signed in" checkbox.
                // If not checked, maybe just state? But reload checks localStorage.
                // Let's us sessionStorage for non-remember-me? 
                // Simplified: Always localStorage if checked, otherwise state only (lost on reload)? 
                // Realistically, users expect some persistence on reload even without "Remember Me".
                // "Remember Me" usually means "Long lived token" vs "Session cookie".
                // For simplicity here:
                // Checked -> localStorage
                // Unchecked -> sessionStorage
                if (rememberMe) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    sessionStorage.setItem('token', data.token);
                    sessionStorage.setItem('user', JSON.stringify(data.user));
                }
            }
            return true;
        } else {
            throw new Error(data.error);
        }
    };

    const signup = async (username, password) => {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            setToken(data.token);
            setUser(data.user);
            // Default to session storage for signup
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('user', JSON.stringify(data.user));
            return true;
        } else {
            throw new Error(data.error);
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    };

    // Helper to get current valid token
    const getToken = () => {
        return localStorage.getItem('token') || sessionStorage.getItem('token') || token;
    };

    const value = {
        user,
        token: getToken(),
        login,
        signup,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
