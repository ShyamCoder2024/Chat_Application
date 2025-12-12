import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useSound } from '../context/SoundContext';
import ChatList from '../components/organisms/ChatList';
import ChatWindow from '../components/organisms/ChatWindow';
import ProfileSection from '../components/organisms/ProfileSection';
import Button from '../components/atoms/Button';
import Input from '../components/atoms/Input';
import Avatar from '../components/atoms/Avatar'; // Import Avatar for search result
import { Plus, MessageCircle, User as UserIcon, Search } from 'lucide-react';
import ThemeToggle from '../components/atoms/ThemeToggle';
import { API_URL } from '../config';
import { decryptMessage } from '../utils/crypto';
import './ChatLayout.css';

const ChatLayout = () => {
    const { user, logout, updateProfile, secretKey } = useAuth();
    const { socket, onlineUsers, isConnected } = useSocket();
    const { playSound } = useSound();

    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [view, setView] = useState('chats'); // chats | chat | profile | user-profile
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [searchResult, setSearchResult] = useState(null); // State for user search result
    const [targetUserProfile, setTargetUserProfile] = useState(null);

    // Ref to track chats for socket listener without re-subscribing
    const chatsRef = useRef(chats);
    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    const [error, setError] = useState(null);

    const [isChatsLoading, setIsChatsLoading] = useState(true);

    // Fetch Chats
    useEffect(() => {
        if (view === 'chats') {
            fetchChats();
        }
    }, [user, view, secretKey]); // Added secretKey dependency

    const fetchChats = async () => {
        if (!user) {
            setIsChatsLoading(false);
            return;
        }
        try {
            setError(null);
            // Add 5 second timeout
            const controller = new AbortController();
            // Increase timeout to 60s for Render cold starts
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            console.log(`Fetching chats from: ${API_URL}/api/chats/${user._id}`);

            // Pagination: Fetch first 20 chats for speed
            const res = await fetch(`${API_URL}/api/chats/${user._id}?page=1&limit=20`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`Failed to load chats: ${res.status}`);
            }
            const data = await res.json();

            // Defensive check - ensure data is array
            if (!Array.isArray(data)) {
                console.error('Invalid chats data received:', data);
                setChats([]);
                setIsChatsLoading(false);
                return;
            }

            const mySecretKey = secretKey;

            const formattedChats = data.map(chat => {
                try {
                    const otherUser = chat.userIds?.find(u => u._id !== user._id);

                    let lastMessageContent = chat.lastMessage?.content || 'No messages yet';

                    // Decrypt last message if encrypted
                    if (chat.lastMessage?.nonce) {
                        try {
                            // Simple AES Decryption (Keys not needed for this mode)
                            lastMessageContent = decryptMessage(chat.lastMessage.content, chat.lastMessage.nonce, null);
                        } catch (err) {
                            lastMessageContent = 'Message'; // Cleaner fallback
                        }
                    } else if (chat.lastMessage?.content && chat.lastMessage.content.startsWith('U2FsdGVkX1')) {
                        // Heuristic: Check for standard CryptoJS prefix (Salted__)
                        lastMessageContent = 'Message';
                    }

                    return {
                        id: chat._id,
                        name: (otherUser?.firstName && otherUser?.lastName)
                            ? `${otherUser.firstName} ${otherUser.lastName}`
                            : (otherUser?.name || otherUser?.phone || 'Unknown User'),
                        avatar: otherUser?.profilePic,
                        otherUserId: otherUser?._id,
                        publicKey: otherUser?.publicKey,
                        lastSeen: otherUser?.lastSeen,
                        lastMessage: lastMessageContent,
                        time: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                        unreadCount: chat.unreadCounts ? (chat.unreadCounts[user._id] || 0) : 0
                    };
                } catch (chatErr) {
                    console.error('Error formatting chat:', chatErr);
                    return null; // Skip problematic chat
                }
            }).filter(Boolean); // Remove null entries

            setChats(formattedChats);
        } catch (err) {
            console.error(err);
            if (err.name === 'AbortError') {
                setError(`Connection timed out. Server: ${API_URL}`);
            } else {
                setError(`Connection failed. Server: ${API_URL}. Error: ${err.message}`);
            }
        } finally {
            setIsChatsLoading(false);
        }
    };



    // const [isSocketConnected, setIsSocketConnected] = useState(socket?.connected || false); // Use context value instead

    // Re-sync on socket reconnection
    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            console.log("Socket connected/reconnected");
            // setIsSocketConnected(true); // Handled by context
            fetchChats();
            if (activeChat) {
                socket.emit('join_room', activeChat.id);
                // Re-fetch messages for active chat to catch up
                fetch(`${API_URL}/api/chats/${activeChat.id}/messages`)
                    .then(res => res.json())
                    .then(data => {
                        const formattedMessages = data.map(msg => ({
                            id: msg._id,
                            content: msg.content,
                            nonce: msg.nonce,
                            senderId: msg.senderId,
                            time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            status: msg.status,
                            type: msg.type || 'text',
                            mediaUrl: msg.mediaUrl
                        }));
                        setMessages(formattedMessages);
                    })
                    .catch(err => console.error("Error re-fetching messages:", err));
            }
        };

        const handleDisconnect = () => {
            console.log("Socket disconnected");
            // setIsSocketConnected(false); // Handled by context
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);

        // Initial check
        // setIsSocketConnected(socket.connected);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
        };
    }, [socket, activeChat]);

    // Ref to track activeChat for socket listener without re-subscribing
    const activeChatRef = useRef(activeChat);
    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // Helper to fetch new chat with retry
    const fetchNewChatWithRetry = async (chatId, retries = 3, delay = 1000) => {
        for (let i = 0; i < retries; i++) {
            try {
                const res = await fetch(`${API_URL}/api/chats/single/${chatId}`);
                if (res.ok) {
                    return await res.json();
                }
            } catch (err) {
                console.warn(`Attempt ${i + 1} to fetch new chat failed:`, err);
            }
            if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new Error(`Failed to fetch new chat ${chatId} after ${retries} attempts`);
    };

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('receive_message', async (message) => {
            playSound('received'); // Play received sound

            const currentChats = chatsRef.current;
            const currentActiveChat = activeChatRef.current; // Use Ref!
            const chatExists = currentChats.some(c => c.id === message.chatId);

            if (currentActiveChat && message.chatId === currentActiveChat.id) {
                // Try to decrypt for better deduplication
                let decryptedContent = message.content;
                if (message.nonce) {
                    try {
                        decryptedContent = decryptMessage(message.content, message.nonce, null);
                    } catch (err) {
                        // console.log("Deduplication decryption failed");
                    }
                }

                setMessages(prev => {
                    // Check if we have an optimistic message with the same NONCE or content
                    // CRITICAL FIX: Only match if the sender is ME (user._id)
                    // Incoming messages from others should NEVER overwrite my optimistic messages
                    const isOptimistic = prev.some(msg =>
                        msg.isOptimistic &&
                        msg.senderId === user._id && // Ensure optimistic message is mine
                        (message.senderId === user._id) && // Ensure incoming message is also marked as mine (echo)
                        (
                            (message.nonce && msg.nonce === message.nonce) || // Match by Nonce (Best)
                            (msg.content === message.content) || // Match by Ciphertext (Rare)
                            (msg.content === decryptedContent) // Match by Decrypted Content (Robust Fallback)
                        )
                    );

                    if (isOptimistic) {
                        return prev.map(msg =>
                            (msg.isOptimistic && msg.senderId === user._id && (message.senderId === user._id) && ((message.nonce && msg.nonce === message.nonce) || msg.content === message.content || msg.content === decryptedContent))
                                ? {
                                    id: message._id,
                                    content: msg.content, // Keep the plaintext we already have!
                                    nonce: message.nonce,
                                    senderId: message.senderId,
                                    time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    status: msg.status,
                                    isPlaintext: true, // Keep it marked as plaintext
                                    type: message.type || 'text',
                                    mediaUrl: message.mediaUrl
                                }
                                : msg
                        );
                    }

                    // If not optimistic, it's a new message
                    return [...prev, {
                        id: message._id,
                        content: message.content, // Keep as is (encrypted)
                        nonce: message.nonce,
                        senderId: message.senderId,
                        createdAt: message.createdAt, // Store raw date
                        time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: message.status,
                        type: message.type || 'text',
                        mediaUrl: message.mediaUrl
                    }];
                });

                // Mark as read immediately if chat is open
                markChatAsRead(currentActiveChat.id);
            }

            // Update Chat List (Sorting & Preview)
            if (chatExists) {
                setChats(prevChats => {
                    const updatedChats = prevChats.map(chat => {
                        if (chat.id === message.chatId) {
                            let previewContent = message.content;
                            // Decrypt preview if needed
                            if (message.nonce) {
                                try {
                                    previewContent = decryptMessage(message.content, message.nonce, null);
                                } catch (err) {
                                    previewContent = 'Message'; // Cleaner fallback
                                }
                            }

                            return {
                                ...chat,
                                lastMessage: previewContent,
                                time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                unreadCount: (currentActiveChat?.id === message.chatId) ? 0 : (chat.unreadCount || 0) + 1
                            };
                        }
                        return chat;
                    });

                    // Sort: Move updated chat to top
                    const activeChatIndex = updatedChats.findIndex(c => c.id === message.chatId);
                    if (activeChatIndex > -1) {
                        const [movedChat] = updatedChats.splice(activeChatIndex, 1);
                        updatedChats.unshift(movedChat);
                    }
                    return updatedChats;
                });
            } else {
                // New Chat! Fetch details and add to list with RETRY
                try {
                    const newChatData = await fetchNewChatWithRetry(message.chatId);
                    const otherUser = newChatData.userIds.find(u => u._id !== user._id);

                    let lastMessageContent = message.content;
                    // Decrypt initial message for new chat
                    if (message.nonce) {
                        try {
                            lastMessageContent = decryptMessage(message.content, message.nonce, null);
                        } catch (err) {
                            lastMessageContent = 'Message'; // Cleaner fallback
                        }
                    }

                    const newChat = {
                        id: newChatData._id,
                        name: (otherUser?.firstName && otherUser?.lastName)
                            ? `${otherUser.firstName} ${otherUser.lastName}`
                            : (otherUser?.name || otherUser?.phone || 'Unknown User'),
                        avatar: otherUser?.profilePic,
                        otherUserId: otherUser?._id,
                        publicKey: otherUser?.publicKey,
                        lastSeen: otherUser?.lastSeen,
                        lastMessage: lastMessageContent,
                        time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        unreadCount: 1
                    };
                    setChats(prev => [newChat, ...prev]);
                } catch (err) {
                    console.error("Error fetching new chat after retries:", err);
                    // Fallback: Force full refresh
                    fetchChats();
                }
            }

            // Notify server that message is delivered
            socket.emit('message_delivered', { messageId: message._id, userId: user._id });
        });

        return () => socket.off('receive_message');
    }, [socket, playSound, secretKey, user._id]); // Removed activeChat from dependency

    const markChatAsRead = async (chatId) => {
        try {
            await fetch(`${API_URL}/api/chats/${chatId}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user._id })
            });

            // Update local state
            setChats(prev => prev.map(c =>
                c.id === chatId ? { ...c, unreadCount: 0 } : c
            ));
        } catch (err) {
            console.error("Error marking chat as read:", err);
        }
    };

    // Handle System Back Button
    useEffect(() => {
        const handlePopState = (event) => {
            const state = event.state;
            if (state && state.view) {
                setView(state.view);
            } else {
                // Default to chats list if no state (root)
                setView('chats');
                setActiveChat(null);
                setTargetUserProfile(null);
                setSearchResult(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const currentChatIdRef = useRef(null);

    const handleSelectChat = React.useCallback(async (chat) => {
        // Push state only if we're not already in this chat (basic check)
        if (activeChat?.id !== chat.id) {
            window.history.pushState({ view: 'chat' }, '');
        }

        // Update Ref to track the LATEST requested chat
        currentChatIdRef.current = chat.id;

        // 1. Set initial chat state (optimistic)
        let currentChat = chat;
        setActiveChat(currentChat);
        setView('chat');
        socket.emit('join_room', chat.id);

        // Mark as read
        markChatAsRead(chat.id);

        try {
            // 2. Fetch FRESH user details to get the latest Public Key
            if (chat.otherUserId) {
                const userRes = await fetch(`${API_URL}/api/users/${chat.otherUserId}`);
                if (userRes.ok) {
                    // Check race condition: Is this still the active chat?
                    if (currentChatIdRef.current !== chat.id) return;

                    const userData = await userRes.json();
                    if (userData.publicKey && userData.publicKey !== chat.publicKey) {
                        console.log("Updated public key for user:", userData.firstName);
                        currentChat = {
                            ...chat,
                            publicKey: userData.publicKey,
                            avatar: userData.profilePic,
                            lastSeen: userData.lastSeen,
                            name: (userData.firstName && userData.lastName)
                                ? `${userData.firstName} ${userData.lastName}`
                                : (userData.name || userData.phone || 'Unknown User')
                        };

                        // Check race condition again before state update
                        if (currentChatIdRef.current === chat.id) {
                            setActiveChat(currentChat);
                        }

                        // Update in chats list too to keep it in sync
                        setChats(prev => prev.map(c => c.id === chat.id ? currentChat : c));
                    }
                }
            }

            // 3. Fetch Messages (Pagination: First 50)
            const res = await fetch(`${API_URL}/api/chats/${chat.id}/messages?limit=50`);
            const data = await res.json();

            // Check race condition: Is this still the active chat?
            if (currentChatIdRef.current !== chat.id) return;

            const formattedMessages = data.map(msg => ({
                id: msg._id,
                content: msg.content,
                nonce: msg.nonce, // Critical: Include nonce for decryption
                senderId: msg.senderId,
                createdAt: msg.createdAt, // Store raw date
                time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: msg.status,
                type: msg.type || 'text',
                mediaUrl: msg.mediaUrl
            }));
            setMessages(formattedMessages);
            setHasMoreMessages(formattedMessages.length >= 50); // If we got 50, there might be more
        } catch (err) {
            console.error("Error fetching messages/user:", err);
            // Only show error if we are still on that chat
            if (currentChatIdRef.current === chat.id) {
                setError("Failed to load chat. Please try again.");
            }
        }
    }, [activeChat, socket, user._id]);

    const handleSendMessage = React.useCallback((content, nonce = null, plaintext = null, metadata = {}) => {
        if (!socket || !activeChat) return;

        playSound('sent'); // Play sent sound

        // Optimistic Update: Show message immediately
        // Use plaintext for local display if available, otherwise content
        const displayContent = plaintext || content;
        const msgType = metadata?.type || 'text';
        const msgMediaUrl = metadata?.mediaUrl || null;

        const tempId = Date.now();
        const optimisticMessage = {
            id: tempId,
            content: displayContent,
            nonce: nonce, // Store the REAL nonce
            senderId: user._id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOptimistic: true,
            isPlaintext: true, // Flag to tell ChatWindow NOT to decrypt this
            type: msgType,
            mediaUrl: msgMediaUrl
        };

        setMessages(prev => [...prev, optimisticMessage]);

        // Update chat list preview immediately AND move to top
        setChats(prev => {
            const updatedChats = prev.map(c =>
                c.id === activeChat.id ? {
                    ...c,
                    lastMessage: msgType === 'image' ? '📷 Photo' : (msgType === 'audio' ? '🎤 Voice Message' : displayContent), // Use plaintext for preview!
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                } : c
            );

            // Sort: Move active chat to top
            const activeChatIndex = updatedChats.findIndex(c => c.id === activeChat.id);
            if (activeChatIndex > -1) {
                const [movedChat] = updatedChats.splice(activeChatIndex, 1);
                updatedChats.unshift(movedChat);
            }
            return updatedChats;
        });

        socket.emit('send_message', {
            chatId: activeChat.id,
            senderId: user._id,
            content, // Send ENCRYPTED content to server
            nonce,
            type: msgType,
            mediaUrl: msgMediaUrl
        });
    }, [socket, activeChat, playSound, user._id]);

    const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    const loadMoreMessages = async () => {
        if (!activeChat || loadingMoreMessages || !hasMoreMessages || messages.length === 0) return;

        setLoadingMoreMessages(true);
        const oldestMessage = messages[0];
        const before = oldestMessage.createdAt || new Date().toISOString();

        try {
            const res = await fetch(`${API_URL}/api/chats/${activeChat.id}/messages?limit=50&before=${before}`);
            const data = await res.json();

            if (data.length < 50) {
                setHasMoreMessages(false);
            }

            if (data.length > 0) {
                const formattedMessages = data.map(msg => ({
                    id: msg._id,
                    content: msg.content,
                    nonce: msg.nonce,
                    senderId: msg.senderId,
                    createdAt: msg.createdAt,
                    time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    status: msg.status
                }));
                setMessages(prev => [...formattedMessages, ...prev]);
            }
        } catch (err) {
            console.error("Error loading more messages:", err);
        } finally {
            setLoadingMoreMessages(false);
        }
    };

    // Listen for status updates
    useEffect(() => {
        if (!socket) return;

        const handleStatusUpdate = ({ messageId, status }) => {
            setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, status } : msg
            ));
        };

        socket.on('message_status_update', handleStatusUpdate);

        return () => {
            socket.off('message_status_update', handleStatusUpdate);
        };
    }, [socket]);

    const handleSearchUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/users/search?phone=${newChatPhone}`);
            const data = await res.json();

            if (res.ok) {
                setSearchResult(data);
            } else {
                alert(data.error || 'User not found');
                setSearchResult(null);
            }
        } catch (err) {
            console.error(err);
            alert('Error searching user');
        }
    };

    const handleStartChat = async () => {
        if (!searchResult) return;

        try {
            const res = await fetch(`${API_URL}/api/chats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentUserId: user._id,
                    targetPhone: searchResult.phone
                })
            });
            const data = await res.json();
            if (data.error) {
                alert(data.error);
                return;
            }

            setShowNewChatModal(false);
            setNewChatPhone('');
            setSearchResult(null);
            fetchChats();

            const otherUser = data.userIds.find(u => u._id !== user._id);
            handleSelectChat({
                id: data._id,
                name: (otherUser?.firstName && otherUser?.lastName)
                    ? `${otherUser.firstName} ${otherUser.lastName}`
                    : (otherUser?.name || otherUser?.phone || 'Unknown User'),
                avatar: otherUser?.profilePic,
                otherUserId: otherUser?._id,
                publicKey: otherUser?.publicKey,
                lastSeen: otherUser?.lastSeen
            });
        } catch (err) {
            console.error(err);
        }
    };

    const handleClearChat = async () => {
        if (!activeChat) return;
        if (window.confirm('Are you sure you want to clear this chat?')) {
            try {
                await fetch(`${API_URL}/api/chats/${activeChat.id}/messages`, {
                    method: 'DELETE'
                });
                setMessages([]);
                fetchChats();
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleBlockUser = async () => {
        if (!activeChat) return;
        if (window.confirm('Block this user? You will not receive messages from them.')) {
            try {
                await fetch(`${API_URL}/api/chats/block`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user._id,
                        blockUserId: activeChat.otherUserId
                    })
                });
                alert('User blocked');
                // Remove from local state immediately
                setChats(prev => prev.filter(c => c.id !== activeChat.id));
                window.history.back(); // Go back to list
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleVisitProfile = async () => {
        if (!activeChat) return;

        try {
            const res = await fetch(`${API_URL}/api/users/${activeChat.otherUserId}`);
            const data = await res.json();

            if (res.ok) {
                setTargetUserProfile(data);
                window.history.pushState({ view: 'user-profile' }, '');
                setView('user-profile');
            } else {
                console.error("Failed to fetch user profile");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const closeNewChatModal = () => {
        setShowNewChatModal(false);
        setNewChatPhone('');
        setSearchResult(null);
    };

    const handleMyProfileClick = () => {
        window.history.pushState({ view: 'profile' }, '');
        setView('profile');
    };

    // Mandatory Profile Update Logic
    const [showMandatoryUpdate, setShowMandatoryUpdate] = useState(false);
    const [updateFirstName, setUpdateFirstName] = useState('');
    const [updateLastName, setUpdateLastName] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (user && (!user.lastName || !user.firstName)) {
            setShowMandatoryUpdate(true);
            setUpdateFirstName(user.firstName || user.name || '');
            setUpdateLastName(user.lastName || '');
        } else {
            setShowMandatoryUpdate(false);
        }
    }, [user]);

    const handleMandatoryUpdate = async (e) => {
        e.preventDefault();
        if (!updateFirstName.trim() || !updateLastName.trim()) {
            alert("Both First Name and Last Name are required.");
            return;
        }

        setIsUpdating(true);
        try {
            await updateProfile({
                firstName: updateFirstName,
                lastName: updateLastName,
                bio: user.bio || '',
                profilePic: user.profilePic || ''
            });
            setShowMandatoryUpdate(false);
            window.location.reload(); // Force reload to ensure fresh state and persistence
        } catch (err) {
            console.error("Failed to update profile", err);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (showMandatoryUpdate) {
        return (
            <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '24px' }}>
                    <h2 style={{ marginBottom: '16px', color: '#2c3e50' }}>Action Required</h2>
                    <p style={{ marginBottom: '24px', color: '#7f8c8d' }}>
                        To continue using MeetPune, please update your profile with your First and Last Name. This helps your friends find you easily!
                    </p>
                    <form onSubmit={handleMandatoryUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>First Name</label>
                            <Input
                                value={updateFirstName}
                                onChange={(e) => setUpdateFirstName(e.target.value)}
                                placeholder="First Name"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Last Name</label>
                            <Input
                                value={updateLastName}
                                onChange={(e) => setUpdateLastName(e.target.value)}
                                placeholder="Last Name"
                            />
                        </div>
                        <Button type="submit" variant="primary" className="full-width" disabled={isUpdating}>
                            {isUpdating ? 'Saving...' : 'Save & Continue'}
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    const getMobileViewClass = () => {
        if (view === 'chat' || view === 'user-profile' || view === 'profile') return 'mobile-view-chat';
        return 'mobile-view-list';
    };

    return (
        <div className={`chat-layout ${getMobileViewClass()}`}>

            <div className="sidebar">
                <div className="sidebar-header">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h1 className="app-title">Messages</h1>
                        {!isConnected && (
                            <span style={{ fontSize: '12px', color: 'orange', fontWeight: '500' }}>Connecting...</span>
                        )}
                    </div>
                    <div className="header-actions">
                        <ThemeToggle />
                        <Button variant="secondary" size="icon" onClick={handleMyProfileClick} title="My Profile">
                            <UserIcon size={24} />
                        </Button>
                        <Button variant="secondary" size="icon" onClick={() => setShowNewChatModal(true)} title="New Chat">
                            <Plus size={24} />
                        </Button>
                    </div>
                </div>

                {error ? (
                    <div className="error-state" style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
                        <p>{error}</p>
                        <Button variant="primary" onClick={fetchChats} style={{ marginTop: '10px' }}>Retry</Button>
                    </div>
                ) : (
                    <ChatList
                        chats={chats}
                        onSelectChat={handleSelectChat}
                        activeChatId={activeChat?.id}
                        isLoading={isChatsLoading}
                        onlineUsers={onlineUsers}
                    />
                )}

                <div className="bottom-nav">
                    <Button variant="text" className={view === 'chats' ? 'active-nav' : ''} onClick={() => {
                        if (view !== 'chats') window.history.back();
                    }}>
                        <MessageCircle size={24} />
                    </Button>
                    <Button variant="text" className={view === 'profile' ? 'active-nav' : ''} onClick={handleMyProfileClick}>
                        <UserIcon size={24} />
                    </Button>
                </div>
            </div>

            <div className="main-content">
                {view === 'profile' ? (
                    <div className="animate-pop-in">
                        <ProfileSection
                            user={user}
                            onLogout={logout}
                            onSave={updateProfile}
                            onBack={() => window.history.back()}
                        />
                    </div>
                ) : view === 'user-profile' ? (
                    <div className="profile-section animate-pop-in">
                        <div className="profile-header-nav" style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
                            <Button variant="text" onClick={() => window.history.back()}>Back to Chat</Button>
                        </div>
                        <div className="profile-content">
                            <div className="profile-header">
                                <img src={targetUserProfile?.profilePic} alt="Profile" style={{ width: 120, height: 120, borderRadius: '50%', marginBottom: 16 }} />
                                <h2 className="profile-name">
                                    {(targetUserProfile?.firstName && targetUserProfile?.lastName)
                                        ? `${targetUserProfile.firstName} ${targetUserProfile.lastName}`
                                        : targetUserProfile?.name}
                                </h2>
                                <p className="profile-bio">{targetUserProfile?.bio}</p>
                            </div>
                        </div>
                    </div>
                ) : activeChat ? (
                    <ChatWindow
                        chat={activeChat}
                        messages={messages}
                        currentUserId={user._id}
                        onSendMessage={handleSendMessage}
                        onBack={() => {
                            window.history.back();
                            setActiveChat(null);
                        }}
                        onClearChat={handleClearChat}
                        onBlockUser={handleBlockUser}
                        onVisitProfile={handleVisitProfile}
                        onLoadMore={loadMoreMessages}
                        hasMore={hasMoreMessages}
                        loadingMore={loadingMoreMessages}
                        isOnline={onlineUsers.has(activeChat.otherUserId)}
                        lastSeen={activeChat.lastSeen}
                    />
                ) : (
                    <div className="empty-state animate-fade-in">
                        <div className="empty-state-content">
                            <MessageCircle size={48} className="empty-state-icon" />
                            <h3>Welcome to MeetPune</h3>
                            <p>Select a chat to start messaging or find a new friend.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Configuration Error Modal */}
            {API_URL.includes('localhost') && window.location.hostname !== 'localhost' && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content" style={{ border: '2px solid red' }}>
                        <h3 style={{ color: 'red' }}>Configuration Error</h3>
                        <p>The app is trying to connect to <b>localhost</b>, but you are on a deployed site.</p>
                        <p>You must set the <b>VITE_API_URL</b> environment variable in Vercel to your Render Backend URL.</p>
                        <div style={{ marginTop: '16px', fontSize: '12px', background: '#f5f5f5', padding: '8px' }}>
                            Current API URL: {API_URL}
                        </div>
                    </div>
                </div>
            )}

            {showNewChatModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Find Friend</h3>
                        {!searchResult ? (
                            <form onSubmit={handleSearchUser}>
                                <Input
                                    placeholder="Enter Mobile Number"
                                    value={newChatPhone}
                                    onChange={(e) => setNewChatPhone(e.target.value)}
                                    autoFocus
                                />
                                <div className="modal-actions">
                                    <Button type="button" variant="text" onClick={closeNewChatModal}>Cancel</Button>
                                    <Button type="submit" variant="primary">Find</Button>
                                </div>
                            </form>
                        ) : (
                            <div className="search-result">
                                <div
                                    className="user-card"
                                    onClick={handleStartChat}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        marginBottom: '16px'
                                    }}
                                >
                                    <Avatar src={searchResult.profilePic} fallback={searchResult.name[0]} size="medium" />
                                    <div>
                                        <h4 style={{ margin: 0 }}>
                                            {(searchResult.firstName && searchResult.lastName)
                                                ? `${searchResult.firstName} ${searchResult.lastName}`
                                                : (searchResult.name || 'Unknown')}
                                        </h4>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{searchResult.phone}</p>
                                    </div>
                                </div>
                                <div className="modal-actions">
                                    <Button type="button" variant="text" onClick={() => setSearchResult(null)}>Back</Button>
                                    <Button type="button" variant="primary" onClick={handleStartChat}>Chat</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatLayout;
