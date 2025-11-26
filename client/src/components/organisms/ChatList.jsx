import React from 'react';
import ChatListItem from '../molecules/ChatListItem';
import './ChatList.css';

import Skeleton from '../atoms/Skeleton';

const ChatList = ({ chats, onSelectChat, activeChatId, isLoading }) => {
    if (isLoading) {
        return (
            <div className="chat-list">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <Skeleton width="48px" height="48px" borderRadius="50%" />
                        <div style={{ flex: 1 }}>
                            <Skeleton width="60%" height="16px" style={{ marginBottom: '8px' }} />
                            <Skeleton width="40%" height="12px" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="chat-list">
            {chats.map((chat) => (
                <ChatListItem
                    key={chat.id}
                    name={chat.name}
                    message={chat.lastMessage}
                    time={chat.time}
                    unreadCount={chat.unreadCount}
                    avatarSrc={chat.avatar}
                    isActive={activeChatId === chat.id}
                    onClick={() => onSelectChat(chat)}
                />
            ))}
        </div>
    );
};

export default ChatList;
