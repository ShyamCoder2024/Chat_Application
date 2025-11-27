import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('btween_theme') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('btween_theme', theme);
    }, [theme]);

    const toggleTheme = async () => {
        // Check if View Transition API is supported
        if (!document.startViewTransition) {
            // Fallback for browsers without View Transition API
            setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
            return;
        }

        // Use View Transition API for smooth animation
        await document.startViewTransition(() => {
            setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
        }).ready;
    };

    const value = React.useMemo(() => ({ theme, toggleTheme }), [theme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
