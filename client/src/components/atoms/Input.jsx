import React from 'react';
import './Input.css';

const Input = ({
    type = 'text',
    placeholder,
    value,
    onChange,
    icon: Icon,
    className = '',
    ...props
}) => {
    return (
        <div className={`input-wrapper ${className}`}>
            <input
                type={type}
                className="input-field"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                {...props}
            />
            {Icon && <Icon className="input-icon" size={20} />}
        </div>
    );
};

export default Input;
