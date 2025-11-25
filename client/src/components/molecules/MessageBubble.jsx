import React from 'react';
import './MessageBubble.css';

const MessageBubble = ({ content, time, isSent }) => {
    return (
        <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
            <div className="message-bubble">
                <p className="message-text">{content}</p>
                <span className="message-time">{time}</span>
            </div>
        </div>
    );
};

export default MessageBubble;
