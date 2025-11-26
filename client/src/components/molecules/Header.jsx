import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '../atoms/Button';
import Avatar from '../atoms/Avatar';
import './Header.css';

const Header = ({ title, subtitle, onBack, actions, avatar }) => {
    return (
        <header className="app-header">
            <div className="header-left">
                {onBack && (
                    <Button variant="secondary" className="back-btn" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </Button>
                )}
                <div className="header-avatar-container">
                    {avatar && <Avatar src={avatar} fallback={title[0]} size="small" />}
                </div>
                <div className="header-title-container">
                    <h1 className="header-title">{title}</h1>
                    {subtitle && <span className="header-subtitle">{subtitle}</span>}
                </div>
            </div>
            <div className="header-actions">
                {actions}
            </div>
        </header>
    );
};

export default Header;
