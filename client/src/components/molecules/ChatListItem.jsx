import React from 'react';
import Avatar from '../atoms/Avatar';
import Badge from '../atoms/Badge';
import './ChatListItem.css';

const ChatListItem = ({
    name,
    message,
    time,
    unreadCount,
    avatarSrc,
    isActive,
    onClick,
    isOnline
}) => {
    return (
        <div
            className={`chat-list-item ${isActive ? 'active' : ''}`}
            onClick={onClick}
        >
            <Avatar src={avatarSrc} fallback={(name || '?')[0]} size="medium" status={isOnline ? 'online' : 'offline'} />

            <div className="chat-info">
                <div className="chat-header">
                    <h3 className="chat-name">{name}</h3>
                    <span className="chat-time">{time}</span>
                </div>

                <div className="chat-footer">
                    <p className="chat-preview">{message}</p>
                    {unreadCount > 0 && <Badge count={unreadCount} />}
                </div>
            </div>
        </div >
    );
};

export default ChatListItem;
