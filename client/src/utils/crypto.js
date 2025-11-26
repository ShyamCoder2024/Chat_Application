import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Generate a new key pair
export const generateKeyPair = () => {
    const keyPair = nacl.box.keyPair();
    return {
        publicKey: encodeBase64(keyPair.publicKey),
        secretKey: encodeBase64(keyPair.secretKey)
    };
};

// Derive shared key (sender's secret key + receiver's public key)
// Note: tweetnacl uses the same function for shared key derivation as box.before
export const deriveSharedKey = (mySecretKey, theirPublicKey) => {
    const secretKeyUint8 = decodeBase64(mySecretKey);
    const publicKeyUint8 = decodeBase64(theirPublicKey);
    return nacl.box.before(publicKeyUint8, secretKeyUint8);
};

// Encrypt a message
export const encryptMessage = (message, sharedKey) => {
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
    const encryptedUint8 = decodeBase64(encryptedMessage);
    const nonceUint8 = decodeBase64(nonce);
    const decrypted = nacl.box.open.after(encryptedUint8, nonceUint8, sharedKey);

    if (!decrypted) {
        throw new Error('Could not decrypt message');
    }

    return new TextDecoder().decode(decrypted);
};
