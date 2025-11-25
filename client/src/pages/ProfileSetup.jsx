import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/atoms/Input';
import Button from '../components/atoms/Button';
import AvatarSelector from '../components/molecules/AvatarSelector';
import './ProfileSetup.css';

const ProfileSetup = () => {
    const { user, updateProfile } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.profilePic || 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            await updateProfile({ name, bio, profilePic: avatar });
            navigate('/');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="setup-container">
            <div className="setup-card">
                <h1 className="setup-title">Complete Profile</h1>
                <p className="setup-subtitle">Tell us a bit about yourself</p>

                <form onSubmit={handleSubmit} className="setup-form">
                    <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />

                    <Input
                        placeholder="Your Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                    />
                    <Input
                        placeholder="Bio (Optional)"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                    <Button type="submit" variant="primary" className="full-width" disabled={!name.trim()}>
                        Get Started
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetup;
