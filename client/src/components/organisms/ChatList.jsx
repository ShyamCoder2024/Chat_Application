import React from 'react';
import ChatListItem from '../molecules/ChatListItem';
import './ChatList.css';

const ChatList = ({ chats, onSelectChat, activeChatId }) => {
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
