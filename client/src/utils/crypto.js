import CryptoJS from 'crypto-js';

// SIMPLE ENCRYPTION IMPLEMENTATION
// As requested, we are moving to a simpler, more robust encryption method
// to avoid the complexity and errors of the previous E2EE implementation.

const APP_SECRET = "meetpune_simple_secret_key_2024"; // In production, use env var

// Legacy functions removed for clarity
// We now use Simple AES with a static APP_SECRET for robust, error-free encryption.

export const encryptMessage = (message, sharedKey) => {
    // Simple AES Encryption
    const encrypted = CryptoJS.AES.encrypt(message, APP_SECRET).toString();
    return {
        encrypted: encrypted,
        nonce: 'simple_nonce' // Dummy nonce to satisfy API structure
    };
};

export const decryptMessage = (encryptedMessage, nonce, sharedKey) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, APP_SECRET);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) return encryptedMessage; // Return original if decryption fails (legacy support)
        return originalText;
    } catch (e) {
        return encryptedMessage; // Fallback to showing raw text if it wasn't encrypted
    }
};
