import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import CryptoJS from 'crypto-js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [secretKey, setSecretKey] = useState(null);

    // Helper: Encrypt Secret Key with Password
    const encryptSecretKey = (secretKey, password) => {
        const iv = CryptoJS.lib.WordArray.random(16);
        const encrypted = CryptoJS.AES.encrypt(secretKey, password, { iv: iv });
        return {
            encryptedKey: encrypted.toString(),
            iv: iv.toString(CryptoJS.enc.Base64)
        };
    };

    // Helper: Decrypt Secret Key with Password
    const decryptSecretKey = (encryptedKey, password, ivBase64) => {
        try {
            const iv = CryptoJS.enc.Base64.parse(ivBase64);
            const bytes = CryptoJS.AES.decrypt(encryptedKey, password, { iv: iv });
            const decrypted = bytes.toString(CryptoJS.enc.Utf8);
            if (!decrypted) throw new Error("Decryption failed");
            return decrypted;
        } catch (err) {
            console.error("Key decryption failed:", err);
            return null;
        }
    };

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
                // Fallback to legacy key if it matches
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

            console.log("✅ Login Successful (Simple Mode)");

            // In Simple Mode, we don't need per-user keys, but we set a dummy one
            // so other components don't break.
            setSecretKey("simple_mode_secret");
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            console.error("❌ Login error:", err);
            throw err;
        }
    };

    const register = async (phone, password, firstName, lastName, profilePic, email) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    password,
                    firstName,
                    lastName,
                    profilePic,
                    publicKey: "simple_mode_pub", // Dummy key
                    encryptedPrivateKey: "simple_mode_priv", // Dummy key
                    iv: "simple_mode_iv", // Dummy IV
                    email // Pass email
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setSecretKey("simple_mode_secret");
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            console.error("Register error:", err);
            throw err;
        }
    };

    const updateProfile = async (updates, userIdOverride = null) => {
        const targetId = userIdOverride || user?._id;
        if (!targetId) return;

        try {
            const res = await fetch(`${API_URL}/api/auth/profile/${targetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Only update state if it's the current user
            if (!userIdOverride || userIdOverride === user?._id) {
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
            }
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
        // Do NOT remove keys, persist them for next login on this device
    };

    const resetKeys = async () => {
        console.log("Reset keys not needed in Simple Mode");
        return true;
    };

    return (
        <AuthContext.Provider value={{ user, secretKey, login, register, logout, updateProfile, resetKeys, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
