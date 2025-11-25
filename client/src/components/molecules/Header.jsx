import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Button from '../atoms/Button';
import './Header.css';

const Header = ({ title, subtitle, onBack, actions }) => {
    return (
        <header className="app-header">
            <div className="header-left">
                {onBack && (
                    <Button variant="secondary" className="back-btn" onClick={onBack}>
                        <ArrowLeft size={20} />
                    </Button>
                )}
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
