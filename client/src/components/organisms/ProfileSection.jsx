import React, { useState } from 'react';
import Avatar from '../atoms/Avatar';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import Header from '../molecules/Header';
import AvatarSelector from '../molecules/AvatarSelector';
import './ProfileSection.css';

const ProfileSection = ({ user, onSave, onLogout, onBack }) => {
    const [name, setName] = useState(user?.name || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.profilePic || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setIsLoading(true);
        setError('');
        try {
            await onSave({ name, bio, profilePic: avatar });
            setIsEditing(false);
        } catch (err) {
            setError('Failed to save profile. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="profile-section">
            <Header title="Profile" onBack={onBack} />

            <div className="profile-content">
                {!isEditing ? (
                    <div className="profile-header">
                        <Avatar src={user?.profilePic} fallback={user?.name?.[0]} size="xlarge" />
                        <div className="profile-info-display">
                            <h2 className="profile-name">{user?.name}</h2>
                            <p className="profile-phone">{user?.phone}</p>
                            <p className="profile-bio">{user?.bio}</p>
                        </div>
                    </div>
                ) : (
                    <div className="profile-form">
                        <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />
                        <div className="form-group">
                            <label>Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Bio</label>
                            <Input
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell us about yourself"
                            />
                        </div>
                        {error && <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                        <div className="form-actions">
                            <Button variant="primary" onClick={handleSave} className="full-width" disabled={isLoading}>
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button variant="text" onClick={() => setIsEditing(false)} className="full-width" disabled={isLoading}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                {!isEditing && (
                    <div className="profile-actions">
                        <Button variant="secondary" onClick={() => {
                            setName(user?.name || '');
                            setBio(user?.bio || '');
                            setAvatar(user?.profilePic || '');
                            setIsEditing(true);
                        }} className="full-width">
                            Edit Profile
                        </Button>
                        <Button variant="text" onClick={onLogout} className="full-width logout-btn">
                            Log Out
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProfileSection;
