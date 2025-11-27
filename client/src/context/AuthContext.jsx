import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { generateKeyPair } from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [secretKey, setSecretKey] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);

            // Load user-specific key
            const userKey = localStorage.getItem(`chat_secret_key_${parsedUser._id}`);
            if (userKey) {
                setSecretKey(userKey);
            } else {
                // Fallback to legacy key if it matches (optional, but safer to just generate new to avoid corruption)
                // For now, let's try to migrate legacy key if it exists
                const legacyKey = localStorage.getItem('chat_secret_key');
                if (legacyKey) {
                    localStorage.setItem(`chat_secret_key_${parsedUser._id}`, legacyKey);
                    localStorage.setItem(`chat_public_key_${parsedUser._id}`, localStorage.getItem('chat_public_key'));
                    setSecretKey(legacyKey);
                }
            }
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

            // Handle Keys
            let mySecretKey = localStorage.getItem(`chat_secret_key_${data.user._id}`);
            let myPublicKey = localStorage.getItem(`chat_public_key_${data.user._id}`);

            if (!mySecretKey || !myPublicKey) {
                // Generate NEW keys for this user
                const keys = generateKeyPair();
                mySecretKey = keys.secretKey;
                myPublicKey = keys.publicKey;

                localStorage.setItem(`chat_secret_key_${data.user._id}`, mySecretKey);
                localStorage.setItem(`chat_public_key_${data.user._id}`, myPublicKey);
            }

            // Ensure server has the correct public key
            if (data.user.publicKey !== myPublicKey) {
                await fetch(`${API_URL}/api/auth/profile/${data.user._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ publicKey: myPublicKey })
                });
                data.user.publicKey = myPublicKey;
            }

            setSecretKey(mySecretKey);
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
            // Generate keys for new user
            const keys = generateKeyPair();

            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    password,
                    firstName,
                    lastName,
                    profilePic,
                    publicKey: keys.publicKey
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Save keys
            localStorage.setItem(`chat_secret_key_${data.user._id}`, keys.secretKey);
            localStorage.setItem(`chat_public_key_${data.user._id}`, keys.publicKey);

            setSecretKey(keys.secretKey);
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
        setSecretKey(null);
        localStorage.removeItem('user');
        // Do NOT remove keys, persist them for next login
    };

    return (
        <AuthContext.Provider value={{ user, secretKey, login, register, logout, updateProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
