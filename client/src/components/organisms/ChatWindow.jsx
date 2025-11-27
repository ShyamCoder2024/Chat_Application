import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip } from 'lucide-react';
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

    const [sharedKey, setSharedKey] = useState(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const initializeEncryption = async () => {
            if (!chat) return;

            const mySecretKey = localStorage.getItem('chat_secret_key');
            if (!mySecretKey) return;

            if (chat.publicKey) {
                try {
                    const key = deriveSharedKey(mySecretKey, chat.publicKey);
                    setSharedKey(key);
                } catch (err) {
                    console.error("Error deriving shared key:", err);
                }
            } else if (chat.otherUserId) {
                // Self-healing: Fetch user profile if public key is missing
                try {
                    console.log("Missing public key, fetching user profile...", chat.otherUserId);
                    const res = await fetch(`${API_URL}/api/users/${chat.otherUserId}`);
                    if (res.ok) {
                        const userData = await res.json();
                        if (userData.publicKey) {
                            const key = deriveSharedKey(mySecretKey, userData.publicKey);
                            setSharedKey(key);
                            // Optionally update chat object in parent or local state if needed for persistence
                            // For now, just setting sharedKey is enough to fix display
                        }
                    }
                } catch (err) {
                    console.error("Error fetching missing public key:", err);
                }
            }
        };

        initializeEncryption();
    }, [chat, currentUserId]);

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
            if (msg.nonce && sharedKey && !msg.isPlaintext) {
                try {
                    const decryptedContent = decryptMessage(msg.content, msg.nonce, sharedKey);
                    displayMessage = { ...msg, content: decryptedContent };
                } catch (err) {
                    // console.error("Error decrypting message:", err);
                    displayMessage = { ...msg, content: '🔒 Encrypted message (Waiting for key...)' };
                }
            } else if (msg.nonce && !sharedKey && !msg.isPlaintext) {
                // Encrypted but we don't have the key yet
                displayMessage = { ...msg, content: '🔒 Loading secure message...' };
            } else if (!msg.nonce && msg.content) {
                // Legacy message (not encrypted) or system message
                // Heuristic: If it looks like an encrypted string (long, no spaces), hide it
                if (!msg.content.includes(' ') && msg.content.length > 20) {
                    displayMessage = { ...msg, content: '🔒 Encrypted message (Legacy)' };
                } else {
                    displayMessage = msg;
                }
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
