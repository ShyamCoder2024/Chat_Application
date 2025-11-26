import React from 'react';
import Avatar from '../atoms/Avatar';
import './AvatarSelector.css';

const AVATAR_SEEDS = [
    'Felix', 'Aneka', 'Zoe', 'Bear', 'Molly',
    'Buddy', 'Oliver', 'Bella', 'Leo', 'Max',
    'Charlie', 'Lucy', 'Coco', 'Ruby', 'Luna',
    'Jack', 'Ginger', 'Lola', 'Sasha', 'Sam',
    'Misty', 'Simba', 'Rocky', 'Jasper', 'Tigger',
    'Shadow', 'Willow', 'Peanut', 'Kiki', 'Oreo'
];

const AvatarSelector = ({ selectedAvatar, onSelect }) => {
    const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=e1ece5,f4e3b1,dce8f5,f9dce6`;

    return (
        <div className="avatar-selector">
            <p className="avatar-selector-label">Choose your avatar</p>
            <div className="avatar-grid">
                {AVATAR_SEEDS.map((seed) => {
                    const url = getAvatarUrl(seed);
                    const isSelected = selectedAvatar === url;
                    return (
                        <div
                            key={seed}
                            className={`avatar-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => onSelect(url)}
                        >
                            <Avatar src={url} size="large" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AvatarSelector;
