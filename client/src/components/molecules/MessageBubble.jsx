import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { API_URL } from '../../config';
import './MessageBubble.css';

const MessageBubble = ({ message, isSent }) => {
    return (
        <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
            <div className="message-bubble-container">
                <div className={`message-bubble ${message.type === 'image' ? 'image-bubble' : ''}`}>
                    {message.type === 'image' ? (
                        <div className="message-image-container">
                            <img
                                src={`${API_URL}${message.mediaUrl}`}
                                alt="Shared photo"
                                className="message-image"
                                loading="lazy"
                                onClick={() => window.open(`${API_URL}${message.mediaUrl}`, '_blank')}
                            />
                        </div>
                    ) : message.type === 'audio' ? (
                        <div className="message-audio-container">
                            <audio controls src={`${API_URL}${message.mediaUrl}`} className="voice-message-player" />
                        </div>
                    ) : (
                        <p className="message-text">{message.content}</p>
                    )}
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
            </div>
        </div>
    );
};

export default React.memo(MessageBubble);
