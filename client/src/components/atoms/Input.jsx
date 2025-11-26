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
    const handleFocus = (e) => {
        // Scroll into view with a slight delay to allow keyboard to open
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);

        if (props.onFocus) {
            props.onFocus(e);
        }
    };

    return (
        <div className={`input-wrapper ${className}`}>
            <input
                type={type}
                className="input-field"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onFocus={handleFocus}
                {...props}
            />
            {Icon && <Icon className="input-icon" size={20} />}
        </div>
    );
};

export default Input;
