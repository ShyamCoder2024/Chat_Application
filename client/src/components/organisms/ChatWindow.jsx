import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import Header from '../molecules/Header';
import MessageBubble from '../molecules/MessageBubble';
import TypingIndicator from '../atoms/TypingIndicator';
import ChatMenu from '../molecules/ChatMenu';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { formatLastSeen, formatMessageDate } from '../../utils/dateUtils';
import { deriveSharedKey, encryptMessage, decryptMessage } from '../../utils/crypto';
import { API_URL } from '../../config';
import './ChatWindow.css';

const ChatWindow = ({ chat, messages, onSendMessage, onBack, currentUserId, onClearChat, onBlockUser, onVisitProfile, isOnline, lastSeen }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const { socket } = useSocket();
    const { secretKey } = useAuth();

    const [sharedKey, setSharedKey] = useState(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const initializeEncryption = async () => {
            if (!chat) return;

            const mySecretKey = secretKey;
            if (!mySecretKey) {
                console.warn("⚠️  No secret key - E2EE disabled for this session");
                return;
            }

            console.log(`🔐 Initializing E2EE for chat with ${chat.name}...`);
            let keyDerived = false;

            // Try to fetch the latest public key from the server
            if (chat.otherUserId) {
                try {
                    const res = await fetch(`${API_URL}/api/users/${chat.otherUserId}`);
                    if (res.ok) {
                        const userData = await res.json();
                        if (userData.publicKey) {
                            console.log(`📥 Fetched public key for ${chat.name}`);
                            const key = deriveSharedKey(mySecretKey, userData.publicKey);
                            if (key) {
                                console.log(`✅ E2EE enabled for ${chat.name}`);
                                setSharedKey(key);
                                keyDerived = true;
                            } else {
                                console.error(`❌ Failed to derive shared key - key derivation returned null`);
                            }
                        } else {
                            console.error(`❌ User ${chat.name} has no public key on server - E2EE unavailable`);
                        }
                    }
                } catch (err) {
                    console.error("❌ Error fetching public key:", err);
                }
            }

            // Fallback to cached public key
            if (!keyDerived && chat.publicKey) {
                try {
                    console.log(`🔐 Using cached public key for ${chat.name}`);
                    const key = deriveSharedKey(mySecretKey, chat.publicKey);
                    if (key) {
                        console.log(`✅ E2EE enabled (cached key) for ${chat.name}`);
                        setSharedKey(key);
                    } else {
                        console.error(`❌ Failed to derive shared key from cache`);
                    }
                } catch (err) {
                    console.error("❌ Error deriving shared key:", err);
                }
            }
        };

        initializeEncryption();
    }, [chat, currentUserId, secretKey]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Socket Typing Listeners
    useEffect(() => {
        if (!socket) return;

        const handleTyping = (data) => {
            if (data.chatId === chat.id && data.userId !== currentUserId) {
                setIsTyping(true);
            }
        };

        const handleStopTyping = (data) => {
            if (data.chatId === chat.id && data.userId !== currentUserId) {
                setIsTyping(false);
            }
        };

        socket.on('typing', handleTyping);
        socket.on('stop_typing', handleStopTyping);

        // Mark messages as read when opening chat
        if (messages.length > 0) {
            const unreadMessages = messages.some(m => !m.read && m.senderId !== currentUserId);
            if (unreadMessages) {
                socket.emit('message_read', { chatId: chat.id, userId: currentUserId });
            }
        }

        return () => {
            socket.off('typing', handleTyping);
            socket.off('stop_typing', handleStopTyping);
        };
    }, [socket, chat.id, currentUserId, messages]);

    const handleInputChange = (e) => {
        setNewMessage(e.target.value);

        if (socket) {
            socket.emit('typing', { chatId: chat.id, userId: currentUserId });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('stop_typing', { chatId: chat.id, userId: currentUserId });
            }, 2000);
        }
    };

    // Cleanup typing timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    const handleSend = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            let messageToSend = newMessage;
            let nonce = null;

            // STRICT E2EE: Only send if we have a shared key
            if (sharedKey) {
                try {
                    const encrypted = encryptMessage(newMessage, sharedKey);
                    messageToSend = encrypted.encrypted;
                    nonce = encrypted.nonce;
                    console.log("✅ Message encrypted successfully");
                } catch (err) {
                    console.error("❌ Error encrypting message:", err);
                    alert("Encryption failed. Message was not sent for security reasons.");
                    return;
                }
            } else {
                console.warn("⚠️  No shared key - preventing plaintext send");
                alert("Encryption keys are not ready yet. Please wait a moment or refresh the page.");
                return;
            }

            onSendMessage(messageToSend, nonce, newMessage);
            setNewMessage('');
            if (socket) {
                socket.emit('stop_typing', { chatId: chat.id, userId: currentUserId });
            }
        }
    };

    const renderMessages = () => {
        const result = [];
        let lastDate = null;

        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.createdAt || Date.now()).toDateString();

            if (msgDate !== lastDate) {
                result.push(
                    <div key={`date-${index}`} className="date-separator">
                        <span>{formatMessageDate(msg.createdAt || Date.now())}</span>
                    </div>
                );
                lastDate = msgDate;
            }

            let displayMessage = msg;

            // Try to decrypt if message has nonce (is encrypted)
            if (msg.nonce && !msg.isPlaintext) {
                if (sharedKey) {
                    try {
                        const decryptedContent = decryptMessage(msg.content, msg.nonce, sharedKey);
                        displayMessage = { ...msg, content: decryptedContent };
                    } catch (err) {
                        // Decryption failed - likely due to key rotation/reset
                        console.warn(`⚠️ Failed to decrypt message ${msg.id}:`, err.message);
                        displayMessage = {
                            ...msg,
                            content: '🔒 Message unavailable (security key changed)',
                            isSystemMessage: true
                        };

                        // Auto-Retry: If this is a recent message (last 1 minute), try to refresh keys
                        const msgTime = new Date(msg.createdAt).getTime();
                        if (Date.now() - msgTime < 60000 && !keyDerivedInSession) {
                            // Only retry if we haven't already derived a fresh key in this session
                            // This prevents infinite loops
                            console.log("🔄 Attempting to refresh keys for recent message...");
                            // We can't easily force a re-render from here without state, 
                            // but we can log it. The real fix is the Reset Button.
                        }
                    }
                } else {
                    // No shared key available yet
                    console.warn(`⚠️  Waiting for encryption keys for ${chat.name}...`);
                    displayMessage = { ...msg, content: '🔐 Verifying security keys...' };
                }
            } else {
                // Plaintext message
                displayMessage = msg;
            }

            result.push(
                <MessageBubble
                    key={msg.id}
                    message={displayMessage}
                    isSent={msg.senderId === currentUserId}
                />
            );
        });

        return result;
    };

    return (
        <div className="chat-window">
            <Header
                title={chat.name}
                subtitle={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isTyping ? 'Typing...' : (isOnline ? 'Online' : formatLastSeen(lastSeen))}
                        {sharedKey && <span style={{ fontSize: '10px', color: '#27ae60', border: '1px solid #27ae60', padding: '0 4px', borderRadius: '4px', marginLeft: '6px' }}>🔒 Secure</span>}
                    </div>
                }
                avatar={chat.avatar}
                onBack={onBack}
                actions={
                    <ChatMenu
                        onVisitProfile={onVisitProfile}
                        onClearChat={onClearChat}
                        onBlockUser={onBlockUser}
                    />
                }
            />

            <div className="messages-area">
                <div className="retention-notice">
                    <p>Messages are end-to-end encrypted 🔒 and auto-delete after 24 hours.</p>
                </div>
                {renderMessages()}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
                <form onSubmit={handleSend} className="message-form">
                    <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={handleInputChange}
                        className="message-input"
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size="icon"
                        className="send-btn"
                        disabled={!newMessage.trim()}
                    >
                        <Send size={20} />
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ChatWindow;
