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
    const [name, setName] = useState('');
    const [avatar, setAvatar] = useState('https://api.dicebear.com/7.x/notionists/svg?seed=Felix');

    const [error, setError] = useState('');
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleNext = (e) => {
        e.preventDefault();
        setError('');

        if (!phone.trim() || !password.trim() || !name.trim()) {
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
                await register(phone, password, name, avatar);
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

    return (
        <div className="login-container">
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
                                    <Input
                                        placeholder="Your Name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoFocus
                                    />
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
    );
};

export default Login;
