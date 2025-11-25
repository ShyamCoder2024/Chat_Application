import React from 'react';
import './Badge.css';

const Badge = ({ count, className = '' }) => {
    if (!count) return null;

    return (
        <span className={`badge ${className}`}>
            {count > 99 ? '99+' : count}
        </span>
    );
};

export default Badge;
