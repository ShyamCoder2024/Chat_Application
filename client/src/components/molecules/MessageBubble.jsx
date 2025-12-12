import React, { useState } from 'react';
import { Check, CheckCheck } from 'lucide-react';
import { API_URL } from '../../config';
import './MessageBubble.css';

const MessageBubble = ({ message, isSent }) => {
    // Construct full URL for media, handling null/undefined
    const getMediaUrl = () => {
        if (!message.mediaUrl) return null;
        try {
            // Check if it's already a full URL
            if (message.mediaUrl.startsWith('http://') || message.mediaUrl.startsWith('https://')) {
                return message.mediaUrl;
            }
            // Handle valid relative paths
            const cleanPath = message.mediaUrl.startsWith('/') ? message.mediaUrl : `/${message.mediaUrl}`;
            return `${API_URL}${cleanPath}`;
        } catch (e) {
            console.error("Error constructing media URL:", e);
            return null;
        }
    };

    const mediaUrl = getMediaUrl();

    // Debug log to trace issues
    if (message.type === 'image' || message.type === 'audio') {
        console.log('MessageBubble rendering media:', { type: message.type, mediaUrl, originalUrl: message.mediaUrl });
    }

    const [imageError, setImageError] = useState(false);

    return (
        <div className={`message-wrapper ${isSent ? 'sent' : 'received'}`}>
            <div className="message-bubble-container">
                <div className={`message-bubble ${message.type === 'image' ? 'image-bubble' : ''} ${message.type === 'audio' ? 'audio-bubble' : ''}`}>
                    {message.type === 'image' && mediaUrl ? (
                        imageError ? (
                            <div className="media-error">
                                <span style={{ fontSize: '24px' }}>⚠️</span>
                                <span style={{ fontSize: '12px', marginTop: '4px' }}>Failed to load image</span>
                            </div>
                        ) : (
                            <div className="message-image-container">
                                <img
                                    src={mediaUrl}
                                    alt="Shared photo"
                                    className="message-image"
                                    loading="lazy"
                                    crossOrigin="anonymous" // Attempt to fix potential CORS issues
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', cursor: 'pointer', minHeight: '100px', backgroundColor: '#f0f0f0' }}
                                    onClick={() => window.open(mediaUrl, '_blank')}
                                    onError={(e) => {
                                        console.error('Image load error:', mediaUrl);
                                        setImageError(true);
                                    }}
                                />
                            </div>
                        )
                    ) : message.type === 'audio' && mediaUrl ? (
                        <div className="message-audio-container">
                            <audio
                                controls
                                className="voice-message-player"
                                crossOrigin="anonymous"
                                onError={(e) => console.error('Audio load error:', mediaUrl)}
                                style={{ width: '100%' }}
                            >
                                <source src={mediaUrl} type="audio/webm" />
                                <source src={mediaUrl} type="audio/mp4" />
                                <source src={mediaUrl} type="audio/mpeg" />
                                <p style={{ fontSize: '11px', color: 'red' }}>Audio unavailable</p>
                            </audio>
                        </div>
                    ) : message.type === 'image' || message.type === 'audio' ? (
                        <p className="message-text" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                            {message.type === 'image' ? '📷 Photo (loading...)' : '🎤 Voice (loading...)'}
                        </p>
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
