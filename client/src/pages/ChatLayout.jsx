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
import { deriveSharedKey, decryptMessage } from '../utils/crypto';
import './ChatLayout.css';

const ChatLayout = () => {
    const { user, logout, updateProfile } = useAuth();
    const { socket, onlineUsers } = useSocket();
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
    }, [user, view]);

    const fetchChats = async () => {
        if (!user) return;
        try {
            setError(null);
            // Add 5 second timeout
            const controller = new AbortController();
            // Increase timeout to 60s for Render cold starts
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            console.log(`Fetching chats from: ${API_URL}/api/chats/${user._id}`);

            const res = await fetch(`${API_URL}/api/chats/${user._id}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`Failed to load chats: ${res.status}`);
            }
            const data = await res.json();
            const mySecretKey = localStorage.getItem('chat_secret_key');

            const formattedChats = data.map(chat => {
                const otherUser = chat.userIds.find(u => u._id !== user._id);

                let lastMessageContent = chat.lastMessage?.content || 'No messages yet';

                // Decrypt last message if encrypted
                if (chat.lastMessage?.nonce) {
                    if (mySecretKey && otherUser?.publicKey) {
                        try {
                            const sharedKey = deriveSharedKey(mySecretKey, otherUser.publicKey);
                            if (sharedKey) {
                                lastMessageContent = decryptMessage(chat.lastMessage.content, chat.lastMessage.nonce, sharedKey);
                            } else {
                                lastMessageContent = '🔒 Encrypted message';
                            }
                        } catch (err) {
                            lastMessageContent = '🔒 Encrypted message';
                        }
                    } else {
                        // Nonce exists but keys are missing
                        lastMessageContent = '🔒 Encrypted message';
                    }
                } else if (chat.lastMessage?.content && !chat.lastMessage.content.includes(' ') && chat.lastMessage.content.length > 20) {
                    // Heuristic: If no nonce, but content looks like a long continuous string (likely base64), assume it's legacy encrypted
                    lastMessageContent = '🔒 Encrypted message';
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
            });
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

    // Re-sync on socket reconnection
    useEffect(() => {
        if (!socket) return;

        const handleReconnect = () => {
            console.log("Socket reconnected, refreshing data...");
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
                            status: msg.status
                        }));
                        setMessages(formattedMessages);
                    })
                    .catch(err => console.error("Error re-fetching messages:", err));
            }
        };

        socket.on('connect', handleReconnect);

        return () => {
            socket.off('connect', handleReconnect);
        };
    }, [socket, activeChat]);

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('receive_message', async (message) => {
            playSound('received'); // Play received sound

            const currentChats = chatsRef.current;
            const chatExists = currentChats.some(c => c.id === message.chatId);

            if (activeChat && message.chatId === activeChat.id) {
                setMessages(prev => {
                    // Check if we have an optimistic message with the same content (simple deduplication)
                    const isOptimistic = prev.some(msg =>
                        msg.isOptimistic &&
                        msg.content === message.content &&
                        msg.senderId === message.senderId
                    );

                    if (isOptimistic) {
                        return prev.map(msg =>
                            (msg.isOptimistic && msg.content === message.content)
                                ? {
                                    id: message._id,
                                    content: message.content,
                                    nonce: message.nonce || msg.nonce, // Preserve nonce!
                                    senderId: message.senderId,
                                    time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    status: msg.status
                                }
                                : msg
                        );
                    }

                    return [...prev, {
                        id: message._id,
                        content: message.content,
                        nonce: message.nonce,
                        senderId: message.senderId,
                        time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        status: message.status
                    }];
                });

                // Mark as read immediately if chat is open
                markChatAsRead(activeChat.id);
            } else if (chatExists) {
                // Increment unread count if chat is not active
                setChats(prevChats => prevChats.map(chat => {
                    if (chat.id === message.chatId) {
                        let previewContent = message.content;
                        // Decrypt preview if needed
                        if (message.nonce) {
                            const mySecretKey = localStorage.getItem('chat_secret_key');
                            if (mySecretKey && chat.publicKey) {
                                try {
                                    const sharedKey = deriveSharedKey(mySecretKey, chat.publicKey);
                                    if (sharedKey) {
                                        previewContent = decryptMessage(message.content, message.nonce, sharedKey);
                                    }
                                } catch (err) {
                                    previewContent = '🔒 Encrypted message';
                                }
                            } else {
                                previewContent = '🔒 Encrypted message';
                            }
                        }

                        return {
                            ...chat,
                            lastMessage: previewContent,
                            time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            unreadCount: (chat.unreadCount || 0) + 1
                        };
                    }
                    return chat;
                }));
            } else {
                // New Chat! Fetch details and add to list
                try {
                    const res = await fetch(`${API_URL}/api/chats/single/${message.chatId}`);
                    if (res.ok) {
                        const newChatData = await res.json();
                        const otherUser = newChatData.userIds.find(u => u._id !== user._id);
                        const newChat = {
                            id: newChatData._id,
                            name: (otherUser?.firstName && otherUser?.lastName)
                                ? `${otherUser.firstName} ${otherUser.lastName}`
                                : (otherUser?.name || otherUser?.phone || 'Unknown User'),
                            avatar: otherUser?.profilePic,
                            otherUserId: otherUser?._id,
                            publicKey: otherUser?.publicKey,
                            lastSeen: otherUser?.lastSeen,
                            lastMessage: message.content,
                            time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            unreadCount: 1
                        };
                        setChats(prev => [newChat, ...prev]);
                    }
                } catch (err) {
                    console.error("Error fetching new chat:", err);
                }
            }

            // Notify server that message is delivered
            socket.emit('message_delivered', { messageId: message._id, userId: user._id });
        });

        return () => socket.off('receive_message');
    }, [socket, activeChat, playSound]); // Removed chats from dependency to avoid re-subscription loop

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

    const handleSelectChat = async (chat) => {
        // Push state only if we're not already in this chat (basic check)
        if (activeChat?.id !== chat.id) {
            window.history.pushState({ view: 'chat' }, '');
        }

        setActiveChat(chat);
        setView('chat');
        socket.emit('join_room', chat.id);

        // Mark as read
        markChatAsRead(chat.id);

        try {
            const res = await fetch(`${API_URL}/api/chats/${chat.id}/messages`);
            const data = await res.json();
            const formattedMessages = data.map(msg => ({
                id: msg._id,
                content: msg.content,
                nonce: msg.nonce, // Critical: Include nonce for decryption
                senderId: msg.senderId,
                time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: msg.status
            }));
            setMessages(formattedMessages);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = (content, nonce = null, plaintext = null) => {
        if (!socket || !activeChat) return;

        playSound('sent'); // Play sent sound

        // Optimistic Update: Show message immediately
        // Use plaintext for local display if available, otherwise content
        const displayContent = plaintext || content;

        const tempId = Date.now();
        const optimisticMessage = {
            id: tempId,
            content: displayContent,
            nonce: plaintext ? null : nonce, // If using plaintext, set nonce to null so ChatWindow doesn't try to decrypt
            senderId: user._id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOptimistic: true
        };

        setMessages(prev => [...prev, optimisticMessage]);

        // Update chat list preview immediately
        setChats(prev => prev.map(c =>
            c.id === activeChat.id ? {
                ...c,
                lastMessage: displayContent, // Use plaintext for preview!
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } : c
        ));

        socket.emit('send_message', {
            chatId: activeChat.id,
            senderId: user._id,
            content, // Send ENCRYPTED content to server
            nonce
        });
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

    return (
        <div className="app-layout">
            <div className={`sidebar ${view !== 'chats' ? 'hidden-mobile' : ''}`}>
                <div className="sidebar-header">
                    <h1 className="app-title">Messages</h1>
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

            <div className={`main-content ${view === 'chats' ? 'hidden-mobile' : ''}`}>
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
                        onSendMessage={handleSendMessage}
                        onBack={() => window.history.back()}
                        currentUserId={user._id}
                        onClearChat={handleClearChat}
                        onBlockUser={handleBlockUser}
                        onVisitProfile={handleVisitProfile}
                        isOnline={onlineUsers.has(activeChat.otherUserId)}
                        lastSeen={activeChat.lastSeen}
                    />
                ) : (
                    <div className="empty-state animate-fade-in">
                        <p>Select a chat to start messaging</p>
                    </div>
                )}
            </div>

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
