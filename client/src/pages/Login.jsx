import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/atoms/Input';
import Button from '../components/atoms/Button';
import AvatarSelector from '../components/molecules/AvatarSelector';
import './Login.css';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState(1); // 1: Credentials, 2: Avatar

    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatar, setAvatar] = useState('https://api.dicebear.com/7.x/notionists/svg?seed=Felix');

    const [error, setError] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleNext = (e) => {
        e.preventDefault();
        setError('');

        if (!phone.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
            setError('All fields are required');
            return;
        }

        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                if (!phone.trim() || !password.trim()) {
                    setError('Phone and password are required');
                    return;
                }
                await login(phone, password);
            } else {
                await register(phone, password, firstName, lastName, avatar);
            }
            navigate('/');
        } catch (err) {
            setError(err.message);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setStep(1);
    };

    // Get a subset of avatars for the showcase
    const showcaseAvatars = [
        'Felix', 'Aneka', 'Zoe', 'Bear', 'Molly',
        'Buddy', 'Oliver', 'Bella', 'Leo', 'Max',
        'Charlie', 'Lucy', 'Coco', 'Ruby', 'Luna'
    ];

    const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=e1ece5,f4e3b1,dce8f5,f9dce6`;

    return (
        <div className="login-page">
            <div className="login-left">
                <div className="login-card animate-pop-in">
                    <div className="login-header">
                        <h1 className="app-name">MeetPune</h1>
                        <p className="app-subtitle">Simple, secure messaging</p>
                    </div>
                    <p className="login-subtitle">
                        {isLogin ? 'Welcome back!' : (step === 1 ? 'Create your account' : 'Choose your look')}
                    </p>

                    {error && <div className="login-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="login-form">
                        {isLogin ? (
                            // LOGIN FORM
                            <>
                                <Input
                                    placeholder="Phone Number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    autoFocus
                                />
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <Button type="submit" variant="primary" className="full-width">
                                    Login
                                </Button>
                            </>
                        ) : (
                            // REGISTER FORM
                            <>
                                {step === 1 ? (
                                    <>
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
                                            placeholder="Phone Number"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                        />
                                        <Input
                                            type="password"
                                            placeholder="Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                        <Button type="button" variant="primary" className="full-width" onClick={handleNext}>
                                            Next
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />
                                        <div className="form-actions-row">
                                            <Button type="button" variant="text" onClick={() => setStep(1)}>
                                                Back
                                            </Button>
                                            <Button type="submit" variant="primary" className="flex-1">
                                                Complete Setup
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        <div className="auth-toggle">
                            <span className="auth-toggle-text">
                                {isLogin ? "Don't have an account? " : "Already have an account? "}
                            </span>
                            <Button
                                type="button"
                                variant="text"
                                className="auth-toggle-btn"
                                onClick={toggleMode}
                            >
                                {isLogin ? 'Register' : 'Login'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="login-right">
                <div className="avatar-showcase">
                    {showcaseAvatars.map((seed, index) => {
                        const row = Math.floor(index / 3);
                        const col = index % 3;
                        return (
                            <div
                                key={seed}
                                className="floating-avatar"
                                style={{
                                    animationDelay: `${index * 0.2}s`,
                                    top: `${row * 25 + 10}%`,
                                    left: `${col * 30 + 10}%`
                                }}
                            >
                                <img src={getAvatarUrl(seed)} alt="Avatar" />
                            </div>
                        );
                    })}
                </div>
                <div className="showcase-content">
                    <h2>Connect with friends</h2>
                    <p>Experience a new way of messaging with MeetPune.</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
