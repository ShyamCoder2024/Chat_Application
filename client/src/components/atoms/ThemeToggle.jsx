import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            className={`theme-toggle ${theme}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
        >
            <div className="toggle-track">
                <div className="toggle-thumb">
                    {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                </div>
            </div>
        </button>
    );
};

export default ThemeToggle;
