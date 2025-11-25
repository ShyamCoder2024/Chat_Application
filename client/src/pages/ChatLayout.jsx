import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import ChatList from '../components/organisms/ChatList';
import ChatWindow from '../components/organisms/ChatWindow';
import ProfileSection from '../components/organisms/ProfileSection';
import Button from '../components/atoms/Button';
import Input from '../components/atoms/Input';
import { Plus, MessageCircle, User as UserIcon } from 'lucide-react';
import ThemeToggle from '../components/atoms/ThemeToggle';
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
    const [targetUserProfile, setTargetUserProfile] = useState(null);

    // Fetch Chats
    useEffect(() => {
        fetchChats();
    }, [user]);

    const fetchChats = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/chats/${user._id}`);
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
                    unreadCount: 0
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
                setMessages(prev => [...prev, {
                    id: message._id,
                    content: message.content,
                    senderId: message.senderId,
                    time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
            }
            fetchChats();
        });

        return () => socket.off('receive_message');
    }, [socket, activeChat]);

    const handleSelectChat = async (chat) => {
        setActiveChat(chat);
        setView('chat');
        socket.emit('join_room', chat.id);

        try {
            const res = await fetch(`http://localhost:3000/api/chats/${chat.id}/messages`);
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

        socket.emit('send_message', {
            chatId: activeChat.id,
            senderId: user._id,
            content
        });
    };

    const handleCreateChat = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:3000/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentUserId: user._id,
                    targetPhone: newChatPhone
                })
            });
            const data = await res.json();
            if (data.error) {
                alert(data.error);
                return;
            }

            setShowNewChatModal(false);
            setNewChatPhone('');
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
                await fetch(`http://localhost:3000/api/chats/${activeChat.id}/messages`, {
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
                await fetch('http://localhost:3000/api/chats/block', {
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

    const handleVisitProfile = () => {
        if (!activeChat) return;
        // Mock profile data from chat info since we don't have a full user fetch endpoint for others yet
        // In a real app, we would fetch user details by ID
        setTargetUserProfile({
            name: activeChat.name,
            phone: 'Hidden', // Or fetch if available
            bio: 'Hey there! I am using MeetPune.', // Mock bio or fetch
            profilePic: activeChat.avatar
        });
        setView('user-profile');
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
                    <ProfileSection
                        user={user}
                        onLogout={logout}
                        onSave={updateProfile}
                        onBack={() => setView('chats')}
                    />
                ) : view === 'user-profile' ? (
                    <div className="profile-section">
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
                    <div className="empty-state">
                        <p>Select a chat to start messaging</p>
                    </div>
                )}
            </div>

            {showNewChatModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>New Chat</h3>
                        <form onSubmit={handleCreateChat}>
                            <Input
                                placeholder="Enter Phone Number"
                                value={newChatPhone}
                                onChange={(e) => setNewChatPhone(e.target.value)}
                                autoFocus
                            />
                            <div className="modal-actions">
                                <Button type="button" variant="text" onClick={() => setShowNewChatModal(false)}>Cancel</Button>
                                <Button type="submit" variant="primary">Start Chat</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatLayout;
