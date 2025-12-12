import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, Loader, Mic } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import Header from '../molecules/Header';
import MessageBubble from '../molecules/MessageBubble';
import TypingIndicator from '../atoms/TypingIndicator';
import ChatMenu from '../molecules/ChatMenu';
import VoiceRecorder from '../molecules/VoiceRecorder';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import { formatLastSeen, formatMessageDate } from '../../utils/dateUtils';
import { encryptMessage, decryptMessage } from '../../utils/crypto';
import { API_URL } from '../../config';
import { compressImage } from '../../utils/mediaUtils';
import './ChatWindow.css';

import { Virtuoso } from 'react-virtuoso';

const ChatWindow = ({ chat, messages, onSendMessage, onBack, currentUserId, onClearChat, onBlockUser, onVisitProfile, isOnline, lastSeen, onLoadMore, hasMore, loadingMore }) => {
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const virtuosoRef = useRef(null); // Virtuoso ref
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const typingTimeoutRef = useRef(null);
    const { socket } = useSocket();
    const { secretKey } = useAuth();
    const isInitialLoad = useRef(true);

    // We don't need manual scroll refs anymore, Virtuoso handles it via initialTopMostItemIndex or followOutput

    // Scroll behavior is now handled by Virtuoso's `followOutput` or `initialTopMostItemIndex`
    // checks.

    // Handle "Last Seen" logic... (keep existing useEffects)

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

    // Helper to process messages for display (decryption + date separators)
    // We need to pre-process this list for Virtuoso because Virtuoso takes a flat list count
    // OR we can pass the data directly.
    // Date separators inject extra items. Let's flatten the list with separators first.

    const [flattenedItems, setFlattenedItems] = useState([]);

    useEffect(() => {
        const items = [];
        let lastDate = null;

        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.createdAt || Date.now()).toDateString();

            if (msgDate !== lastDate) {
                items.push({ type: 'separator', date: msg.createdAt || Date.now(), id: `date-${index}` });
                lastDate = msgDate;
            }

            items.push({ type: 'message', data: msg, id: msg.id });
        });
        setFlattenedItems(items);
    }, [messages]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        if (!file.type.startsWith('image/')) {
            alert("Only images are supported for now.");
            return;
        }

        // 1. Optimistic UI: Show immediately
        const tempId = Date.now();
        const localUrl = URL.createObjectURL(file);

        // Add temporary message to UI
        const optimisticMessage = {
            id: tempId,
            content: 'Photo',
            senderId: currentUserId,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'image',
            mediaUrl: localUrl,
            status: 'sending',
            isOptimistic: true // Flag to identify and replace later
        };

        // Update local state immediately
        // We pass a function to setMessages to safely append
        // Note: The parent component manages messages, but we can't easily update its state directly 
        // without a prop function for "addOptimisticMessage". 
        // However, looking at the code, onSendMessage sends to socket. 
        // We will call onSendMessage with a special flag or handle it locally if possible.
        // Actually, the best pattern here without refactoring the parent (ChatLayout) too much 
        // is to let the upload finish, BUT for "smoothness" we really want to show it now.
        // 
        // Since ChatWindow receives `messages` as a prop, we can't mutate it directly.
        // BUT, ChatLayout has `handleSendMessage` which does optimistic updates for TEXT.
        // We should leverage that or specific logic.
        //
        // Let's look at `onSendMessage` signature in ChatLayout: 
        // handleSendMessage(content, nonce, plaintext, metadata)
        // It ALREADY does optimistic updates! 
        // So we just need to pass the LOCAL URL in metadata first? 
        // No, `onSendMessage` sends to socket immediately. We don't want to send the local blob URL to socket.

        // REVISED STRATEGY: 
        // We will maintain a `localUploadingMessages` state in ChatWindow to show *pending* uploads
        // overlaid on the messages list, OR we just block-UI (less smooth).
        // OR better: We simply upload FAST (compression) and assume the user accepts a small delay.
        // 
        // WAIT, the user explicitly asked for "smoother experience".
        // The best way is:
        // 1. Compress (Fast)
        // 2. Upload
        // 3. Send
        // 
        // If we want TRUE optimistic (WhatsApp style), we need to modify ChatLayout to handle "pending uploads".
        // Given constraints, I will use `compressImage` to speed it up significantly, 
        // and add a "Sending..." toast or indicator if I can't easily touch ChatLayout state deeply.

        // ACTUALLY, I can modify `onSendMessage` in ChatWindow to be smarter? No, it calls prop.

        // Let's stick to the plan: Client-side compression drastically reduces upload time (e.g. 5MB -> 300KB).
        // This alone makes it feel much faster. 
        // Combined with `setIsUploading(true)` which shows a loader button.

        // Let's try to pass the local preview to `onSendMessage`? 
        // If I pass the local URL, the socket will broadcast it to others who CANNOT see it. Bad.

        // OK, I will implement **Compression** first as it's the biggest win. 
        // And I will optimize the "Loading" state to be less obtrusive.

        setIsUploading(true);
        try {
            // Compress!
            const compressedFile = await compressImage(file);

            const formData = new FormData();
            formData.append('file', compressedFile);

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await res.json();
            console.log("Image upload response:", data);

            onSendMessage('Photo', null, 'Photo', {
                type: 'image',
                mediaUrl: data.url
            });

        } catch (err) {
            console.error("Upload error:", err);
            alert(`Failed to upload image: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleAudioSend = async (audioBlob) => {
        setIsRecording(false);
        // Show lightweight loading state
        // setIsUploading(true); // Don't block the UI with a global loader for audio, maybe? 
        // Actually, preventing spam is good.
        setIsUploading(true);

        try {
            const formData = new FormData();
            const blob = new Blob([audioBlob], { type: 'audio/webm' });
            formData.append('file', blob, 'voice_message.webm');

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Upload failed');
            }

            const data = await res.json();
            console.log("Audio upload response:", data);

            onSendMessage('Voice Message', null, 'Voice Message', {
                type: 'audio',
                mediaUrl: data.url
            });

        } catch (err) {
            console.error("Audio upload error:", err);
            alert(`Failed to send voice message: ${err.message}`);
        } finally {
            setIsUploading(false);
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

            onSendMessage(messageToSend, nonce, newMessage, { type: 'text' });
            setNewMessage('');
            if (socket) {
                socket.emit('stop_typing', { chatId: chat.id, userId: currentUserId });
            }
        }
    };

    const renderItem = (index, item) => {
        if (item.type === 'separator') {
            return (
                <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center', opacity: 0.8 }}>
                    <span className="date-separator-span" style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: 'var(--text-secondary)'
                    }}>
                        {formatMessageDate(item.date)}
                    </span>
                </div>
            );
        }

        const msg = item.data;
        let displayMessage = msg;

        // Try to decrypt if message has nonce (is encrypted)
        if (msg.nonce && !msg.isPlaintext) {
            try {
                const decryptedContent = decryptMessage(msg.content, msg.nonce, null);
                displayMessage = { ...msg, content: decryptedContent };
            } catch (err) {
                // console.warn(`⚠️ Failed to decrypt message ${msg.id}`);
                displayMessage = { ...msg, content: '🔒 Encrypted message' };
            }
        }

        return (
            <MessageBubble
                key={msg.id}
                message={displayMessage}
                isSent={msg.senderId === currentUserId}
            />
        );
    };

    return (
        <div className="chat-window">
            {/* Header */}
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

            <div className="messages-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 0 }}>
                {/* Retention Notice - Static at top or part of list? Better as part of list header */}

                <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: '100%', width: '100%' }}
                    data={flattenedItems}
                    itemContent={renderItem}
                    initialTopMostItemIndex={flattenedItems.length - 1} // Start at bottom
                    followOutput={'auto'} // Auto scroll to bottom when new messages arrive
                    startReached={hasMore ? onLoadMore : undefined}
                    components={{
                        Header: () => (
                            <div style={{ padding: '20px' }}>
                                {loadingMore && (
                                    <div style={{ textAlign: 'center', padding: '10px', color: '#888', fontSize: '12px' }}>
                                        Loading older messages...
                                    </div>
                                )}
                                <div className="retention-notice">
                                    <p>Messages are end-to-end encrypted 🔒 and auto-delete after 24 hours.</p>
                                </div>
                            </div>
                        ),
                        Footer: () => <div style={{ height: '20px' }}></div> // Spacing at bottom
                    }}
                />

                {isTyping && (
                    <div style={{ padding: '0 20px 10px 20px' }}>
                        <TypingIndicator />
                    </div>
                )}
            </div>

            <div className="input-area">
                {/* ... (existing Input Area code) */}
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
