import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { generateKeyPair } from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        // Check for E2EE keys
        if (!localStorage.getItem('chat_secret_key')) {
            const keys = generateKeyPair();
            localStorage.setItem('chat_public_key', keys.publicKey);
            localStorage.setItem('chat_secret_key', keys.secretKey);
        }

        setLoading(false);
    }, []);

    const login = async (phone, password) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Ensure keys exist
            let publicKey = localStorage.getItem('chat_public_key');
            if (!publicKey) {
                const keys = generateKeyPair();
                publicKey = keys.publicKey;
                localStorage.setItem('chat_public_key', keys.publicKey);
                localStorage.setItem('chat_secret_key', keys.secretKey);
            }

            // If server user doesn't have public key, update it
            if (!data.user.publicKey) {
                await updateProfile({ publicKey });
                data.user.publicKey = publicKey;
            }

            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            console.error("Login error:", err);
            throw err;
        }
    };

    const register = async (phone, password, firstName, lastName, profilePic) => {
        try {
            // Ensure keys exist
            let publicKey = localStorage.getItem('chat_public_key');
            if (!publicKey) {
                const keys = generateKeyPair();
                publicKey = keys.publicKey;
                localStorage.setItem('chat_public_key', keys.publicKey);
                localStorage.setItem('chat_secret_key', keys.secretKey);
            }

            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password, firstName, lastName, profilePic, publicKey })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            console.error("Register error:", err);
            throw err;
        }
    };

    const updateProfile = async (updates) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/profile/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            console.error("Update profile error:", err);
            throw err;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, updateProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
