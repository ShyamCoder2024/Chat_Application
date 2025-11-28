import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
import { encryptMessage, decryptMessage } from '../../utils/crypto';
import { API_URL } from '../../config';
import './ChatWindow.css';

const ChatWindow = ({ chat, messages, onSendMessage, onBack, currentUserId, onClearChat, onBlockUser, onVisitProfile, isOnline, lastSeen, onLoadMore, hasMore, loadingMore }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const { socket } = useSocket();
    const { secretKey } = useAuth();
    const isInitialLoad = useRef(true);
    const previousScrollHeightRef = useRef(0);

    const scrollToBottom = (behavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    // Instant scroll on mount/chat change, smooth on new messages
    useLayoutEffect(() => {
        if (messages.length > 0) {
            if (isInitialLoad.current) {
                scrollToBottom('auto'); // Instant
                isInitialLoad.current = false;
            } else if (loadingMore) {
                // Restore scroll position after loading more
                if (messagesContainerRef.current) {
                    const newScrollHeight = messagesContainerRef.current.scrollHeight;
                    const scrollDiff = newScrollHeight - previousScrollHeightRef.current;
                    messagesContainerRef.current.scrollTop = scrollDiff;
                }
            } else {
                // Only scroll to bottom if we are already near bottom or it's a new message from us
                const container = messagesContainerRef.current;
                if (container) {
                    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                    const lastMessage = messages[messages.length - 1];
                    const isMyMessage = lastMessage?.senderId === currentUserId;

                    if (isNearBottom || isMyMessage) {
                        scrollToBottom('smooth');
                    }
                }
            }
        }
    }, [messages, chat.id, loadingMore, currentUserId]);

    // Reset initial load flag when chat changes
    useEffect(() => {
        isInitialLoad.current = true;
        previousScrollHeightRef.current = 0;
    }, [chat.id]);

    // Reset initial load flag when chat changes
    useEffect(() => {
        isInitialLoad.current = true;
    }, [chat.id]);

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

    const handleScroll = () => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight } = messagesContainerRef.current;
            if (scrollTop === 0 && hasMore && !loadingMore) {
                previousScrollHeightRef.current = scrollHeight;
                onLoadMore();
            }
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            let messageToSend = newMessage;
            let nonce = null;

            // Simple Encryption
            try {
                const encrypted = encryptMessage(newMessage, null);
                messageToSend = encrypted.encrypted;
                nonce = encrypted.nonce;
            } catch (err) {
                console.error("❌ Error encrypting message:", err);
                alert("Encryption failed.");
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
                try {
                    // Simple Decryption
                    const decryptedContent = decryptMessage(msg.content, msg.nonce, null);
                    displayMessage = { ...msg, content: decryptedContent };
                } catch (err) {
                    console.warn(`⚠️ Failed to decrypt message ${msg.id}:`, err.message);
                    displayMessage = { ...msg, content: '🔒 Encrypted message' };
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

            <div
                className="messages-area"
                ref={messagesContainerRef}
                onScroll={handleScroll}
            >
                {loadingMore && (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#888', fontSize: '12px' }}>
                        Loading older messages...
                    </div>
                )}
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
