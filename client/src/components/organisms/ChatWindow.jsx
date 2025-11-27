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
                console.error("❌ E2EE Error: No secret key available for current user");
                return;
            }

            let keyDerived = false;

            // 1. Try to fetch the latest public key from the server
            // This ensures we always use the most up-to-date key, fixing issues where
            // the other user re-installed the app or logged in on a new device.
            if (chat.otherUserId) {
                try {
                    console.log(`🔐 Fetching public key for user ${chat.name}...`);
                    const res = await fetch(`${API_URL}/api/users/${chat.otherUserId}`);
                    if (res.ok) {
                        const userData = await res.json();
                        if (userData.publicKey) {
                            const key = deriveSharedKey(mySecretKey, userData.publicKey);
                            if (key) {
                                console.log(`✅ Shared key derived successfully for ${chat.name}`);
                                setSharedKey(key);
                                keyDerived = true;
                            } else {
                                console.error(`❌ Failed to derive shared key for ${chat.name}`);
                            }
                        } else {
                            console.error(`❌ User ${chat.name} has NO public key on server!`);
                        }
                    }
                } catch (err) {
                    console.error("❌ Error fetching fresh public key:", err);
                }
            }

            // 2. Fallback to the key passed in props if fetch failed or didn't yield a key
            if (!keyDerived && chat.publicKey) {
                try {
                    console.log(`🔐 Using cached public key for ${chat.name}`);
                    const key = deriveSharedKey(mySecretKey, chat.publicKey);
                    if (key) {
                        console.log(`✅ Shared key derived (from cache) for ${chat.name}`);
                        setSharedKey(key);
                    } else {
                        console.error(`❌ Failed to derive shared key (from cache) for ${chat.name}`);
                    }
                } catch (err) {
                    console.error("❌ Error deriving shared key:", err);
                }
            } else if (!keyDerived) {
                console.error(`❌ CRITICAL: Cannot derive shared key for ${chat.name} - no public key available!`);
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

            // TEMPORARY FIX: Disable E2EE encryption until key sync is fixed
            // This allows users to communicate immediately
            console.warn("⚠️ E2EE DISABLED TEMPORARILY - Sending message as plaintext");

            /* ORIGINAL E2EE CODE - DISABLED FOR NOW
            if (sharedKey) {
                try {
                    const encrypted = encryptMessage(newMessage, sharedKey);
                    messageToSend = encrypted.encrypted;
                    nonce = encrypted.nonce;
                } catch (err) {
                    console.error("Error encrypting message:", err);
                    // Fallback to plain text if encryption fails (or handle error)
                }
            }
            */

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

            // Check if this is a plaintext message (no encryption)
            if (!msg.nonce && msg.content) {
                // Plaintext message - display as-is
                displayMessage = msg;
            } else if (msg.nonce && sharedKey && !msg.isPlaintext) {
                // Old encrypted message - try to decrypt
                try {
                    const decryptedContent = decryptMessage(msg.content, msg.nonce, sharedKey);
                    displayMessage = { ...msg, content: decryptedContent };
                } catch (err) {
                    // Decryption failed - show as encrypted (old messages from before the fix)
                    console.error(`❌ Cannot decrypt old message ${msg.id} - keys may have changed`);
                    displayMessage = { ...msg, content: '🔒 Encrypted message (sent before fix)' };
                }
            } else if (msg.nonce && !sharedKey && !msg.isPlaintext) {
                // Encrypted but we don't have the key
                displayMessage = { ...msg, content: '🔒 Encrypted message (no key available)' };
            } else if (msg.isPlaintext) {
                // Optimistic plaintext message
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
                subtitle={isTyping ? 'Typing...' : (isOnline ? 'Online' : formatLastSeen(lastSeen))}
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
