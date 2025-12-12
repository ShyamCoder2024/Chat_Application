import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SoundContext = createContext();

export const useSound = () => useContext(SoundContext);

export const SoundProvider = ({ children }) => {
    const [soundEnabled, setSoundEnabled] = useState(() => {
        const saved = localStorage.getItem('soundEnabled');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const audioContextRef = useRef(null);
    const audioUnlockedRef = useRef(false);

    useEffect(() => {
        localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
    }, [soundEnabled]);

    // Initialize AudioContext on first user interaction
    const initAudioContext = () => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }
        audioUnlockedRef.current = true;
    };

    // Unlock audio on any user interaction
    useEffect(() => {
        const unlockAudio = () => {
            initAudioContext();
            // Remove listeners after first interaction
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('touchend', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };

        document.addEventListener('touchstart', unlockAudio, { passive: true });
        document.addEventListener('touchend', unlockAudio, { passive: true });
        document.addEventListener('click', unlockAudio, { passive: true });

        return () => {
            document.removeEventListener('touchstart', unlockAudio);
            document.removeEventListener('touchend', unlockAudio);
            document.removeEventListener('click', unlockAudio);
        };
    }, []);

    // Generate bubble sound using Web Audio API
    const playSound = (type) => {
        if (!soundEnabled) return;

        try {
            initAudioContext();
            const ctx = audioContextRef.current;
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (type === 'sent') {
                // BUBBLE POP SOUND - Quick descending "bloop"
                oscillator.frequency.setValueAtTime(1400, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.12);
            } else {
                // BUBBLE RECEIVE SOUND - Softer ascending bubble
                oscillator.frequency.setValueAtTime(400, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
                oscillator.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                oscillator.start(ctx.currentTime);
                oscillator.stop(ctx.currentTime + 0.2);
            }
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
