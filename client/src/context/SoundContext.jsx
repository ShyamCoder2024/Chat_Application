import React, { createContext, useContext, useState, useEffect } from 'react';

const SoundContext = createContext();

export const useSound = () => useContext(SoundContext);

export const SoundProvider = ({ children }) => {
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('soundEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    }, [soundEnabled]);

    const playSound = (type) => {
        if (!soundEnabled) return;

        try {
            const audio = new Audio(`/sounds/${type}.mp3`);
            audio.volume = 0.5;
            audio.play().catch(err => console.log('Audio play failed:', err));
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    };

    return (
        <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, playSound }}>
            {children}
        </SoundContext.Provider>
    );
};
