import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import './MessageBubble.css';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥'];

const MessageBubble = ({ message, isSent, onReact }) => {
    const [showReactions, setShowReactions] = useState(false);

    const handleReactionClick = (emoji) => {
        onReact(message.id, emoji);
        setShowReactions(false);
    };

    return (
        <div
            className={`message-wrapper ${isSent ? 'sent' : 'received'}`}
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
        >
            <div className="message-bubble-container">
                <div className="message-bubble">
                    <p className="message-text">{message.content}</p>
                    <div className="message-meta">
                        <span className="message-time">{message.time}</span>
                        {isSent && (
                            <span className={`message-status ${message.status}`}>
                                {message.status === 'sent' && <Check size={14} />}
                                {message.status === 'delivered' && <CheckCheck size={14} />}
                                {message.status === 'read' && <CheckCheck size={14} color="#34B7F1" />}
                            </span>
                        )}
                    </div>
                </div>

                {/* Reactions Display */}
                {message.reactions && message.reactions.length > 0 && (
                    <div className="message-reactions">
                        {message.reactions.map((r, i) => (
                            <span key={i}>{r.emoji}</span>
                        ))}
                    </div>
                )}

                {/* Reaction Picker */}
                {showReactions && (
                    <div className={`reaction-picker ${isSent ? 'left' : 'right'}`}>
                        {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => handleReactionClick(emoji)}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageBubble;
