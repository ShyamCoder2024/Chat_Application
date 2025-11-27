import React, { useState, useEffect } from 'react';
import Avatar from '../atoms/Avatar';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import Header from '../molecules/Header';
import AvatarSelector from '../molecules/AvatarSelector';
import { useSound } from '../../context/SoundContext';
import { Volume2, VolumeX } from 'lucide-react';
import { API_URL } from '../../config';
import './ProfileSection.css';

const ProfileSection = ({ user, onSave, onLogout, onBack, onResetKeys }) => {
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [bio, setBio] = useState(user?.bio || '');
    const [avatar, setAvatar] = useState(user?.profilePic || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [blockedUsers, setBlockedUsers] = useState([]);
    const { soundEnabled, setSoundEnabled } = useSound();

    useEffect(() => {
        if (user && !isEditing) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setBio(user.bio || '');
            setAvatar(user.profilePic || '');
        }
    }, [user, isEditing]);

    const fetchBlockedUsers = async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/blocked/${user._id}`);
            if (res.ok) {
                const data = await res.json();
                setBlockedUsers(data);
            }
        } catch (err) {
            console.error("Failed to fetch blocked users", err);
        }
    };

    const handleUnblock = async (blockUserId) => {
        try {
            const res = await fetch(`${API_URL}/api/chats/unblock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user._id, blockUserId })
            });

            if (res.ok) {
                setBlockedUsers(prev => prev.filter(u => u._id !== blockUserId));
            }
        } catch (err) {
            console.error("Failed to unblock user", err);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        setError('');
        try {
            await onSave({ firstName, lastName, bio, profilePic: avatar });
            // Small delay to allow parent state to update before switching view
            // This prevents the "jitter" where old data flashes briefly
            setTimeout(() => {
                setIsEditing(false);
            }, 100);
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
                    <>
                        <div className="profile-header">
                            <Avatar src={user?.profilePic} fallback={(user?.firstName || user?.name)?.[0]} size="xlarge" />
                            <div className="profile-info-display">
                                <h2 className="profile-name">
                                    {(user?.firstName && user?.lastName)
                                        ? `${user.firstName} ${user.lastName}`
                                        : user?.name}
                                </h2>
                                <p className="profile-phone">{user?.phone}</p>
                                <p className="profile-bio">{user?.bio}</p>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-title">Settings</h3>
                            <div className="setting-item">
                                <div className="setting-info">
                                    {soundEnabled ? <Volume2 size={20} className="setting-icon active" /> : <VolumeX size={20} className="setting-icon" />}
                                    <span className="setting-label">Sound Notifications</span>
                                </div>
                                <label className="toggle-switch">
                                    <input
                                        type="checkbox"
                                        checked={soundEnabled}
                                        onChange={(e) => setSoundEnabled(e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>

                        <div className="settings-section">
                            <h3 className="settings-title">Blocked Users</h3>
                            {blockedUsers.length === 0 ? (
                                <p className="no-blocked-users">No blocked users</p>
                            ) : (
                                <div className="blocked-users-list">
                                    {blockedUsers.map(blockedUser => (
                                        <div key={blockedUser._id} className="blocked-user-item">
                                            <div className="blocked-user-info">
                                                <Avatar src={blockedUser.profilePic} fallback={(blockedUser.firstName || blockedUser.name)?.[0]} size="medium" />
                                                <div className="blocked-user-details">
                                                    <span className="blocked-user-name">
                                                        {(blockedUser.firstName && blockedUser.lastName)
                                                            ? `${blockedUser.firstName} ${blockedUser.lastName}`
                                                            : blockedUser.name}
                                                    </span>
                                                    <span className="blocked-user-phone">{blockedUser.phone}</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                onClick={() => handleUnblock(blockedUser._id)}
                                                className="unblock-btn"
                                            >
                                                Unblock
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>


                    </>
                ) : (
                    <div className="profile-form">
                        <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />
                        <div className="form-group">
                            <label>First Name</label>
                            <Input
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="First Name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Last Name</label>
                            <Input
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Last Name"
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
                            setFirstName(user?.firstName || '');
                            setLastName(user?.lastName || '');
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
