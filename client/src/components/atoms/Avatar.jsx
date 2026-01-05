import React from 'react';
import './Avatar.css';

const Avatar = ({
    src,
    alt,
    size = 'medium',
    status,
    fallback = '?',
    className = ''
}) => {
    return (
        <div className={`avatar avatar-${size} ${className}`}>
            {src ? (
                <img src={src} alt={alt} className="avatar-img" />
            ) : (
                <div className="avatar-fallback">{fallback}</div>
            )}
            {status === 'online' && <span className="avatar-status" />}
        </div>
    );
};

export default React.memo(Avatar);
