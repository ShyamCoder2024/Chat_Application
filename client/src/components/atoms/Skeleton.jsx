import React from 'react';
import './Skeleton.css';

const Skeleton = ({ width, height, borderRadius, style }) => {
    return (
        <div
            className="skeleton"
            style={{
                width,
                height,
                borderRadius: borderRadius || '4px',
                ...style
            }}
        />
    );
};

export default Skeleton;
