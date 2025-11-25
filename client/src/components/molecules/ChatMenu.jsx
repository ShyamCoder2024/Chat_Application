import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, User, Trash2, Ban } from 'lucide-react';
import Button from '../atoms/Button';
import './ChatMenu.css';

const ChatMenu = ({ onVisitProfile, onClearChat, onBlockUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="chat-menu-container" ref={menuRef}>
            <Button variant="text" size="icon" onClick={() => setIsOpen(!isOpen)}>
                <MoreVertical size={20} />
            </Button>

            {isOpen && (
                <div className="chat-menu-dropdown animate-pop-in">
                    <button className="chat-menu-item" onClick={() => { onVisitProfile(); setIsOpen(false); }}>
                        <User size={16} />
                        <span>Visit Profile</span>
                    </button>
                    <button className="chat-menu-item" onClick={() => { onClearChat(); setIsOpen(false); }}>
                        <Trash2 size={16} />
                        <span>Clear Chat</span>
                    </button>
                    <button className="chat-menu-item danger" onClick={() => { onBlockUser(); setIsOpen(false); }}>
                        <Ban size={16} />
                        <span>Block User</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChatMenu;
