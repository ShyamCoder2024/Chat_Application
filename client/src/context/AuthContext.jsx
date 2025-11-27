import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_URL } from '../config';
import { generateKeyPair } from '../utils/crypto';
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

            let mySecretKey = localStorage.getItem(`chat_secret_key_${data.user._id}`);
            let myPublicKey = localStorage.getItem(`chat_public_key_${data.user._id}`);

            // KEY SYNC LOGIC
            if (data.user.encryptedPrivateKey && data.user.iv) {
                // Case 1: Server has the key. Decrypt and use it.
                // This syncs the key across devices (Laptop <-> Mobile)
                const decryptedKey = decryptSecretKey(data.user.encryptedPrivateKey, password, data.user.iv);
                if (decryptedKey) {
                    mySecretKey = decryptedKey;
                    myPublicKey = data.user.publicKey; // Trust server public key if we have the private key

                    // Save to local storage
                    localStorage.setItem(`chat_secret_key_${data.user._id}`, mySecretKey);
                    localStorage.setItem(`chat_public_key_${data.user._id}`, myPublicKey);
                }
            }

            if (!mySecretKey || !myPublicKey) {
                // Case 2: No key on server AND no key locally. Generate NEW keys.
                // This happens for a brand new user (shouldn't happen if register works) or a legacy user on a new device with no server backup.
                const keys = generateKeyPair();
                mySecretKey = keys.secretKey;
                myPublicKey = keys.publicKey;

                localStorage.setItem(`chat_secret_key_${data.user._id}`, mySecretKey);
                localStorage.setItem(`chat_public_key_${data.user._id}`, myPublicKey);

                // BACKUP NEW KEY TO SERVER
                const { encryptedKey, iv } = encryptSecretKey(mySecretKey, password);
                await updateProfile({
                    encryptedPrivateKey: encryptedKey,
                    iv: iv,
                    publicKey: myPublicKey
                }, data.user._id); // Pass ID explicitly as user state might not be set yet
            } else if (!data.user.encryptedPrivateKey) {
                // Case 3: We have a local key, but server has nothing (Legacy User).
                // BACKUP EXISTING KEY TO SERVER so other devices can use it.
                const { encryptedKey, iv } = encryptSecretKey(mySecretKey, password);
                await updateProfile({
                    encryptedPrivateKey: encryptedKey,
                    iv: iv,
                    publicKey: myPublicKey
                }, data.user._id);
            }

            // Ensure server has the correct public key (redundant check but safe)
            if (data.user.publicKey !== myPublicKey) {
                await updateProfile({ publicKey: myPublicKey }, data.user._id);
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

            // Encrypt Secret Key for Server Backup
            const { encryptedKey, iv } = encryptSecretKey(keys.secretKey, password);

            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone,
                    password,
                    firstName,
                    lastName,
                    profilePic,
                    publicKey: keys.publicKey,
                    encryptedPrivateKey: encryptedKey,
                    iv: iv
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            // Save keys locally
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

    return (
        <AuthContext.Provider value={{ user, secretKey, login, register, logout, updateProfile, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
