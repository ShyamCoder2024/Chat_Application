import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Loader, Mic } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useSound } from '../../context/SoundContext';
import Header from '../molecules/Header';
import MessageBubble from '../molecules/MessageBubble';
import TypingIndicator from '../atoms/TypingIndicator';
import ChatMenu from '../molecules/ChatMenu';
import VoiceRecorder from '../molecules/VoiceRecorder';
import Button from '../atoms/Button';
import { formatLastSeen, formatMessageDate } from '../../utils/dateUtils';
import { encryptMessage, decryptMessage } from '../../utils/crypto';
import { API_URL } from '../../config';
import { compressImage } from '../../utils/mediaUtils';
import './ChatWindow.css';

const ChatWindow = ({ chat, messages, onSendMessage, onBack, currentUserId, onClearChat, onBlockUser, onVisitProfile, isOnline, lastSeen, onLoadMore, hasMore, loadingMore }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null); // REF FOR SCROLL TO BOTTOM
    const messagesContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const typingTimeoutRef = useRef(null);
    const { socket } = useSocket();
    const { secretKey } = useAuth();
    const { playSound } = useSound();
    const [viewportHeight, setViewportHeight] = useState('100dvh');

    // SIMPLE SCROLL TO BOTTOM - MOST RELIABLE METHOD
    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
    };

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

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    }, []);

    // Process messages with decryption
    const [processedMessages, setProcessedMessages] = useState([]);
    const [pendingUploads, setPendingUploads] = useState([]);

    useEffect(() => {
        const decrypted = messages.map(msg => {
            let content = msg.content;
            if (msg.nonce && !msg.isPlaintext && !msg.isDecrypted) {
                try {
                    content = decryptMessage(msg.content, msg.nonce, null);
                } catch (err) {
                    content = '🔒 Encrypted message';
                }
            }
            return { ...msg, content, isDecrypted: true };
        });

        const allMessages = [...decrypted, ...pendingUploads].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.time || Date.now());
            const dateB = new Date(b.createdAt || b.time || Date.now());
            return dateA - dateB;
        });

        setProcessedMessages(allMessages);
    }, [messages, pendingUploads]);

    // SCROLL TO BOTTOM ON INITIAL LOAD AND WHEN MESSAGES CHANGE
    useEffect(() => {
        scrollToBottom();
        // Multiple attempts for mobile reliability
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
        setTimeout(scrollToBottom, 300);
    }, [processedMessages.length, chat.id]);

    // SCROLL TO BOTTOM ON KEYBOARD OPEN
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            setViewportHeight(`${window.visualViewport.height}px`);
            // ALWAYS scroll to bottom when keyboard opens
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
            setTimeout(scrollToBottom, 200);
        };

        setViewportHeight(`${window.visualViewport.height}px`);

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);

        return () => {
            window.visualViewport.removeEventListener('resize', handleResize);
            window.visualViewport.removeEventListener('scroll', handleResize);
        };
    }, []);

    // Input focus handler for additional scroll trigger
    const handleInputFocus = () => {
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
        setTimeout(scrollToBottom, 500);
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            alert("Only images are supported for now.");
            return;
        }

        const tempId = `pending-${Date.now()}`;
        const localUrl = URL.createObjectURL(file);

        const pendingMsg = {
            id: tempId,
            content: 'Photo',
            senderId: currentUserId,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
            type: 'image',
            mediaUrl: localUrl,
            status: 'sending',
            isOptimistic: true,
            isPlaintext: true
        };

        setPendingUploads(prev => [...prev, pendingMsg]);
        setIsUploading(true);
        playSound('sent');

        try {
            const compressedFile = await compressImage(file);
            const formData = new FormData();
            formData.append('file', compressedFile);

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();

            onSendMessage('Photo', null, 'Photo', {
                type: 'image',
                mediaUrl: data.url
            });

            setPendingUploads(prev => prev.filter(m => m.id !== tempId));

        } catch (err) {
            console.error("Upload error:", err);
            alert(`Failed to upload image: ${err.message}`);
            setPendingUploads(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsUploading(false);
        }
    };

    const handleAudioSend = async (audioBlob) => {
        setIsRecording(false);
        const tempId = `pending-audio-${Date.now()}`;
        const localUrl = URL.createObjectURL(audioBlob);

        const pendingMsg = {
            id: tempId,
            content: 'Voice Message',
            senderId: currentUserId,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdAt: new Date().toISOString(),
            type: 'audio',
            mediaUrl: localUrl,
            status: 'sending',
            isOptimistic: true,
            isPlaintext: true
        };
        setPendingUploads(prev => [...prev, pendingMsg]);
        setIsUploading(true);
        playSound('sent');

        try {
            const formData = new FormData();
            const blob = new Blob([audioBlob], { type: 'audio/webm' });
            formData.append('file', blob, 'voice_message.webm');

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();

            onSendMessage('Voice Message', null, 'Voice Message', {
                type: 'audio',
                mediaUrl: data.url
            });

            setPendingUploads(prev => prev.filter(m => m.id !== tempId));

        } catch (err) {
            console.error("Audio upload error:", err);
            alert(`Failed to send voice message: ${err.message}`);
            setPendingUploads(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (newMessage.trim()) {
            const tempId = `optimistic-${Date.now()}`;
            const messageText = newMessage;

            // PLAY SOUND IMMEDIATELY
            playSound('sent');

            const optimisticMsg = {
                id: tempId,
                content: messageText,
                senderId: currentUserId,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: new Date().toISOString(),
                type: 'text',
                status: 'sending',
                isOptimistic: true,
                isPlaintext: true
            };

            setPendingUploads(prev => [...prev, optimisticMsg]);
            setNewMessage('');

            // SCROLL IMMEDIATELY AFTER ADDING MESSAGE
            requestAnimationFrame(() => {
                scrollToBottom();
                setTimeout(scrollToBottom, 50);
                setTimeout(scrollToBottom, 150);
            });

            setTimeout(() => {
                let messageToSend = messageText;
                let nonce = null;

                try {
                    const encrypted = encryptMessage(messageText, null);
                    messageToSend = encrypted.encrypted;
                    nonce = encrypted.nonce;

                    onSendMessage(messageToSend, nonce, messageText, { type: 'text' });
                    setPendingUploads(prev => prev.filter(m => m.id !== tempId));

                    if (socket) {
                        socket.emit('stop_typing', { chatId: chat.id, userId: currentUserId });
                    }
                } catch (err) {
                    console.error("Encryption error:", err);
                    alert("Failed to send message");
                    setPendingUploads(prev => prev.filter(m => m.id !== tempId));
                }
            }, 0);
        }
    };

    // Group messages by date for separators
    const renderMessages = () => {
        let lastDate = null;
        const elements = [];

        processedMessages.forEach((msg, index) => {
            const msgDate = new Date(msg.createdAt || Date.now()).toDateString();

            if (msgDate !== lastDate) {
                elements.push(
                    <div key={`sep-${index}`} className="date-separator">
                        <span>{formatMessageDate(msg.createdAt || new Date())}</span>
                    </div>
                );
                lastDate = msgDate;
            }

            elements.push(
                <MessageBubble
                    key={msg.id}
                    message={msg}
                    isSent={msg.senderId === currentUserId}
                />
            );
        });

        return elements;
    };

    return (
        <div className="chat-window" style={{ height: viewportHeight }}>
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

            {/* SIMPLE SCROLLABLE MESSAGE LIST - NO VIRTUOSO */}
            <div
                ref={messagesContainerRef}
                className="messages-area messages-scroll-container"
            >
                <div className="retention-notice">
                    <p>Messages are end-to-end encrypted 🔒 and auto-delete after 24 hours.</p>
                </div>

                {loadingMore && (
                    <div style={{ textAlign: 'center', padding: '10px', color: '#888', fontSize: '12px' }}>
                        Loading older messages...
                    </div>
                )}

                {renderMessages()}

                {isTyping && (
                    <div style={{ padding: '0 10px 10px 10px' }}>
                        <TypingIndicator />
                    </div>
                )}

                {/* INVISIBLE ELEMENT TO SCROLL TO */}
                <div ref={messagesEndRef} style={{ height: '1px' }} />
            </div>

            <div className="input-area">
                {isRecording ? (
                    <VoiceRecorder
                        onSend={handleAudioSend}
                        onCancel={() => setIsRecording(false)}
                    />
                ) : (
                    <form onSubmit={handleSend} className="message-form">
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            {isUploading ? <Loader className="spin" size={20} /> : <Paperclip size={20} />}
                        </Button>
                        <textarea
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={handleInputChange}
                            onFocus={handleInputFocus}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend(e);
                                }
                            }}
                            className="message-input textarea"
                            rows={1}
                            style={{ resize: 'none' }}
                        />
                        {newMessage.trim() ? (
                            <Button
                                type="submit"
                                variant="primary"
                                size="icon"
                                className="send-btn"
                                disabled={isUploading}
                            >
                                <Send size={20} />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="primary"
                                size="icon"
                                className="mic-btn"
                                onClick={() => setIsRecording(true)}
                            >
                                <Mic size={20} />
                            </Button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
};

export default ChatWindow;
