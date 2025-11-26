import nacl from 'tweetnacl';

// Polyfill for Base64 encoding/decoding of Uint8Array
const encodeBase64 = (arr) => {
    const bin = [];
    arr.forEach((byte) => bin.push(String.fromCharCode(byte)));
    return btoa(bin.join(''));
};

const decodeBase64 = (str) => {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

// Generate a new key pair
export const generateKeyPair = () => {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey)
    };
};

// Derive shared key (sender's secret key + receiver's public key)
export const deriveSharedKey = (mySecretKey, theirPublicKey) => {
    try {
        const secretKeyUint8 = decodeBase64(mySecretKey);
        const publicKeyUint8 = decodeBase64(theirPublicKey);
        return nacl.box.before(publicKeyUint8, secretKeyUint8);
    } catch (err) {
        console.error("Error deriving shared key:", err);
        return null;
    }
};

// Encrypt a message
export const encryptMessage = (message, sharedKey) => {
    if (!sharedKey) throw new Error("No shared key provided");
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = new TextEncoder().encode(message);
    const encrypted = nacl.box.after(messageUint8, nonce, sharedKey);

    return {
        encrypted: encodeBase64(encrypted),
        nonce: encodeBase64(nonce)
    };
};

// Decrypt a message
export const decryptMessage = (encryptedMessage, nonce, sharedKey) => {
    if (!sharedKey) throw new Error("No shared key provided");
    const encryptedUint8 = decodeBase64(encryptedMessage);
    const nonceUint8 = decodeBase64(nonce);
    const decrypted = nacl.box.open.after(encryptedUint8, nonceUint8, sharedKey);

    if (!decrypted) {
        throw new Error('Could not decrypt message');
    }

    return new TextDecoder().decode(decrypted);
};
