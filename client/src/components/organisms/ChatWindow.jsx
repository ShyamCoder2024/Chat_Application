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
    const [pendingUploads, setPendingUploads] = useState([]); // Local state for uploads in progress

    useEffect(() => {
        const items = [];
        let lastDate = null;

        // 1. Process standard messages with Pre-Decryption
        const processedMessages = messages.map(msg => {
            // Decrypt once here if needed
            let content = msg.content;
            if (msg.nonce && !msg.isPlaintext && !msg.isDecrypted) { // Add flag check to prevent re-decrypt
                try {
                    content = decryptMessage(msg.content, msg.nonce, null);
                } catch (err) {
                    content = '🔒 Encrypted message';
                }
            }
            return { ...msg, content, isDecrypted: true };
        });

        // 2. Combine with Pending Uploads
        // We want pending uploads at the bottom, but sorted by time ideally. 
        // Since they are "new", they are usually at the end.
        const allMessages = [...processedMessages, ...pendingUploads].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.time || Date.now()); // Handle various date formats
            const dateB = new Date(b.createdAt || b.time || Date.now());
            return dateA - dateB;
        });

        allMessages.forEach((msg, index) => {
            const rawDate = msg.createdAt || (msg.isOptimistic ? new Date() : Date.now());
            const msgDate = new Date(rawDate).toDateString();

            if (msgDate !== lastDate) {
                items.push({ type: 'separator', date: rawDate, id: `date-${index}-${msgDate}` });
                lastDate = msgDate;
            }

            items.push({ type: 'message', data: msg, id: msg.id });
        });
        setFlattenedItems(items);
    }, [messages, pendingUploads]);

    // Force scroll to bottom when MY message is added (including optimistic ones)
    // REMOVED: Managed by Virtuoso followOutput now
    useEffect(() => {
        // Just keeping the dependency here to force re-evaluation of scroll strategy if needed
    }, [flattenedItems, currentUserId]);

    // Initial Mount Scroll Logic - Ensure we start at bottom
    // Virtuoso handles `initialTopMostItemIndex` but sometimes with async data it needs a nudge
    // Initial Mount & Updates Scroll Logic
    // We want to force scroll to bottom on:
    // 1. Initial Load
    // 2. When a new message arrives and we are already at the bottom (handled by followOutput)
    // 3. When WE send a message (handled by followOutput)

    // However, sometimes on mobile initial load is flaky. Let's force it on mount.
    useEffect(() => {
        if (flattenedItems.length > 0) {
            // Small delay to ensure Virtuoso has calculated sizes
            const timer = setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: flattenedItems.length - 1,
                    align: 'end',
                    behavior: 'auto' // Instant jump on load
                });
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [chat.id, flattenedItems.length === 0]); // Run when chat changes or we first get items


    // Mobile Keyboard & Viewport Handling - URGENT FIX
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            if (virtuosoRef.current) {
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                    // Use 'auto' for instant jump to avoid keyboard covering input
                    virtuosoRef.current.scrollToIndex({
                        index: flattenedItems.length - 1,
                        align: 'end',
                        behavior: 'auto'
                    });

                    // Safety retry for slower devices
                    setTimeout(() => {
                        virtuosoRef.current?.scrollToIndex({
                            index: flattenedItems.length - 1,
                            align: 'end',
                            behavior: 'auto'
                        });
                    }, 50);
                    setTimeout(() => {
                        virtuosoRef.current?.scrollToIndex({
                            index: flattenedItems.length - 1,
                            align: 'end',
                            behavior: 'auto'
                        });
                    }, 150);
                }
            }
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);

        return () => {
            window.visualViewport.removeEventListener('resize', handleResize);
            window.visualViewport.removeEventListener('scroll', handleResize);
        };
    }, [flattenedItems.length]); // Re-bind when items change to ensure latest count

    // Aggressive Auto-Scroll for New Messages (Self & Optimistic)
    useEffect(() => {
        const lastItem = flattenedItems[flattenedItems.length - 1];
        if (!lastItem) return;

        // If I just sent a message (or uploading), FORCE SCROLL DOWN INSTANTLY
        if ((lastItem.type === 'message' && lastItem.data.senderId === currentUserId) ||
            (lastItem.data && lastItem.data.isOptimistic)) {

            virtuosoRef.current?.scrollToIndex({
                index: flattenedItems.length - 1,
                align: 'end',
                behavior: 'auto' // Instant feedback is better than smooth here
            });

            // Double tap for safety
            setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: flattenedItems.length - 1,
                    align: 'end',
                    behavior: 'smooth' // Smooth correct after instant jump
                });
            }, 100);
        }
    }, [flattenedItems.length, currentUserId]);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; // Reset input

        if (!file.type.startsWith('image/')) {
            alert("Only images are supported for now.");
            return;
        }

        // 1. Immediate Optimistic UI
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

        try {
            // 2. Compress & Upload
            const compressedFile = await compressImage(file);
            const formData = new FormData();
            formData.append('file', compressedFile);

            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();

            // 3. Send Real Message (socket)
            // This will trigger updates to `messages` prop via ChatLayout
            onSendMessage('Photo', null, 'Photo', {
                type: 'image',
                mediaUrl: data.url
            });

            // 4. Remove local pending item (Parent's optimistic update takes over)
            setPendingUploads(prev => prev.filter(m => m.id !== tempId));

        } catch (err) {
            console.error("Upload error:", err);
            alert(`Failed to upload image: ${err.message}`);
            // Keep pending item but mark error? Or remove?
            // For now, remove it to prevent "stuck" messages
            setPendingUploads(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsUploading(false);
        }
    };

    const handleAudioSend = async (audioBlob) => {
        setIsRecording(false);
        const tempId = `pending-audio-${Date.now()}`;
        const localUrl = URL.createObjectURL(audioBlob);

        // Optimistic Audio
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

        // Render the pre-processed message (already decrypted)
        return (
            <MessageBubble
                key={item.id}
                message={item.data}
                isSent={item.data.senderId === currentUserId}
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
                    // Simpler followOutput: Only auto-scroll for others if already at bottom
                    followOutput={(isAtBottom) => {
                        return isAtBottom ? 'smooth' : false;
                    }}
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
                        Footer: () => <div style={{ height: '40px' }}></div>
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
