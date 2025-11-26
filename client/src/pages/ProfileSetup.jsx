import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/atoms/Input';
import Button from '../components/atoms/Button';
import AvatarSelector from '../components/molecules/AvatarSelector';
import './ProfileSetup.css';

const ProfileSetup = () => {
    const { user, updateProfile } = useAuth();
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.profilePic || 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) return;

        try {
            await updateProfile({ firstName, lastName, bio, profilePic: avatar });
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

                    <div className="name-inputs" style={{ display: 'flex', gap: '10px' }}>
                        <Input
                            placeholder="First Name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            autoFocus
                        />
                        <Input
                            placeholder="Last Name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                    </div>
                    <Input
                        placeholder="Bio (Optional)"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                    />
                    <Button type="submit" variant="primary" className="full-width" disabled={!firstName.trim() || !lastName.trim()}>
                        Get Started
                    </Button>
                </form>
            </div>
        </div>
    );
};

export default ProfileSetup;
