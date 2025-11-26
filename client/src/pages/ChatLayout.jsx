import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChatList from '../components/organisms/ChatList';
import ChatWindow from '../components/organisms/ChatWindow';
import ProfileSection from '../components/organisms/ProfileSection';
import Button from '../components/atoms/Button';
import Input from '../components/atoms/Input';
import Avatar from '../components/atoms/Avatar'; // Import Avatar for search result
import { Plus, MessageCircle, User as UserIcon, Search } from 'lucide-react';
import ThemeToggle from '../components/atoms/ThemeToggle';
import { API_URL } from '../config';
import './ChatLayout.css';

const ChatLayout = () => {
    const { user, logout, updateProfile } = useAuth();
    const { socket, onlineUsers } = useSocket();
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [view, setView] = useState('chats'); // chats | chat | profile | user-profile
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatPhone, setNewChatPhone] = useState('');
    const [searchResult, setSearchResult] = useState(null); // State for user search result
    const [targetUserProfile, setTargetUserProfile] = useState(null);

    // Fetch Chats
    useEffect(() => {
        fetchChats();
    }, [user]);

    const fetchChats = async () => {
        try {
            const res = await fetch(`${API_URL}/api/chats/${user._id}`);
            const data = await res.json();

            const formattedChats = data.map(chat => {
                const otherUser = chat.userIds.find(u => u._id !== user._id);
                return {
                    id: chat._id,
                    name: otherUser?.name || otherUser?.phone,
                    avatar: otherUser?.profilePic,
                    otherUserId: otherUser?._id,
                    lastMessage: chat.lastMessage?.content || 'No messages yet',
                    time: chat.lastMessage?.timestamp ? new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    unreadCount: chat.unreadCounts ? (chat.unreadCounts[user._id] || 0) : 0
                };
            });
            setChats(formattedChats);
        } catch (err) {
            console.error(err);
        }
    };

    // Socket Listeners
    useEffect(() => {
        if (!socket) return;

        socket.on('receive_message', (message) => {
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
                                    senderId: message.senderId,
                                    time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                }
                                : msg
                        );
                    }

                    return [...prev, {
                        id: message._id,
                        content: message.content,
                        senderId: message.senderId,
                        time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }];
                });

                // Mark as read immediately if chat is open
                markChatAsRead(activeChat.id);
            } else {
                // Increment unread count if chat is not active
                setChats(prevChats => prevChats.map(chat => {
                    if (chat.id === message.chatId) {
                        return {
                            ...chat,
                            lastMessage: message.content,
                            time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            unreadCount: (chat.unreadCount || 0) + 1
                        };
                    }
                    return chat;
                }));
            }
            // We don't call fetchChats() here to avoid overwriting local optimistic updates
            // But we might want to refresh the list order eventually
        });

        return () => socket.off('receive_message');
    }, [socket, activeChat]);

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

    const handleSelectChat = async (chat) => {
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
                senderId: msg.senderId,
                time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));
            setMessages(formattedMessages);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSendMessage = (content) => {
        if (!socket || !activeChat) return;

        // Optimistic Update: Show message immediately
        const tempId = Date.now();
        const optimisticMessage = {
            id: tempId,
            content,
            senderId: user._id,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isOptimistic: true
        };

        setMessages(prev => [...prev, optimisticMessage]);

        // Update chat list preview immediately
        setChats(prev => prev.map(c =>
            c.id === activeChat.id ? {
                ...c,
                lastMessage: content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            } : c
        ));

        socket.emit('send_message', {
            chatId: activeChat.id,
            senderId: user._id,
            content
        });
    };

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
                name: otherUser?.name || otherUser?.phone,
                avatar: otherUser?.profilePic,
                otherUserId: otherUser?._id
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
                setView('chats');
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

    return (
        <div className="app-layout">
            <div className={`sidebar ${view !== 'chats' ? 'hidden-mobile' : ''}`}>
                <div className="sidebar-header">
                    <h1 className="app-title">Messages</h1>
                    <div className="header-actions">
                        <ThemeToggle />
                        <Button variant="secondary" size="icon" onClick={() => setView('profile')} title="My Profile">
                            <UserIcon size={24} />
                        </Button>
                        <Button variant="secondary" size="icon" onClick={() => setShowNewChatModal(true)} title="New Chat">
                            <Plus size={24} />
                        </Button>
                    </div>
                </div>

                <ChatList
                    chats={chats}
                    onSelectChat={handleSelectChat}
                    activeChatId={activeChat?.id}
                    isLoading={chats.length === 0 && !activeChat}
                    onlineUsers={onlineUsers}
                />

                <div className="bottom-nav">
                    <Button variant="text" className={view === 'chats' ? 'active-nav' : ''} onClick={() => setView('chats')}>
                        <MessageCircle size={24} />
                    </Button>
                    <Button variant="text" className={view === 'profile' ? 'active-nav' : ''} onClick={() => setView('profile')}>
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
                            onBack={() => setView('chats')}
                        />
                    </div>
                ) : view === 'user-profile' ? (
                    <div className="profile-section animate-pop-in">
                        <div className="profile-header-nav" style={{ padding: '16px', borderBottom: '1px solid #eee' }}>
                            <Button variant="text" onClick={() => setView('chat')}>Back to Chat</Button>
                        </div>
                        <div className="profile-content">
                            <div className="profile-header">
                                <img src={targetUserProfile?.profilePic} alt="Profile" style={{ width: 120, height: 120, borderRadius: '50%', marginBottom: 16 }} />
                                <h2 className="profile-name">{targetUserProfile?.name}</h2>
                                <p className="profile-bio">{targetUserProfile?.bio}</p>
                            </div>
                        </div>
                    </div>
                ) : activeChat ? (
                    <ChatWindow
                        chat={activeChat}
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        onBack={() => setView('chats')}
                        currentUserId={user._id}
                        onClearChat={handleClearChat}
                        onBlockUser={handleBlockUser}
                        onVisitProfile={handleVisitProfile}
                        isOnline={onlineUsers.has(activeChat.otherUserId)}
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
                                        <h4 style={{ margin: 0 }}>{searchResult.name || 'Unknown'}</h4>
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
