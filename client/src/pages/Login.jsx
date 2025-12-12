import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/atoms/Input';
import Button from '../components/atoms/Button';
import AvatarSelector from '../components/molecules/AvatarSelector';
import ThreeBackground from '../components/atoms/ThreeBackground';
import { API_URL } from '../config';
import './Login.css';

const Login = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isForgotPassword, setIsForgotPassword] = useState(false); // New state for Forgot Password flow
    const [step, setStep] = useState(1); // 1: Credentials, 2: Avatar
    const [resetStep, setResetStep] = useState(1); // 1: Email, 2: OTP, 3: New Password

    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState(''); // New Email state
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatar, setAvatar] = useState('https://api.dicebear.com/7.x/notionists/svg?seed=Felix');

    // Reset Password States
    const [resetEmail, setResetEmail] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newResetPassword, setNewResetPassword] = useState('');

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState(''); // For feedback
    const [isLoading, setIsLoading] = useState(false); // Loading state

    const { login, register } = useAuth();
    const navigate = useNavigate();

    // ... (Viewport resize effect remains same)

    const handleNext = (e) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (!phone.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
            setError('All fields are required');
            return;
        }

        // Email is optional in schema but good to collect if user wants to set it
        // If we make it required in UI:
        if (!email.trim()) {
            setError('Email is required for account recovery');
            return;
        }

        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                if (!phone.trim() || !password.trim()) {
                    setError('Phone and password are required');
                    setIsLoading(false);
                    return;
                }
                await login(phone, password);
                navigate('/');
            } else {
                // Register
                await register(phone, password, firstName, lastName, avatar, email); // Pass email
                navigate('/');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Forgot Password Handlers
    const handleForgotPasswordRequest = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, email: resetEmail }) // Send Phone + Email
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccessMessage(data.message);
            setResetStep(2); // Move to OTP
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            // Step 2: Verify OTP and Set New Password
            const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp: resetOtp, password: newResetPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSuccessMessage('Password reset successfully! Logging you in...');

            // Auto-Login Logic
            await login(phone, newResetPassword);
            navigate('/');

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setStep(1);
        setIsForgotPassword(false);
    };

    // Get a subset of avatars for the showcase
    const showcaseAvatars = [
        'Felix', 'Aneka', 'Zoe', 'Bear', 'Molly',
        'Buddy', 'Oliver', 'Bella', 'Leo', 'Max',
        'Charlie', 'Lucy', 'Coco', 'Ruby', 'Luna'
    ];

    const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=e1ece5,f4e3b1,dce8f5,f9dce6`;

    // RENDER:
    return (
        <div className="login-page">
            <ThreeBackground />
            <div className="login-left">
                <div className="login-card animate-pop-in">
                    <div className="login-header">
                        <h1 className="app-name">MeetPune</h1>
                        <p className="app-subtitle">Simple, secure messaging</p>
                    </div>

                    {!isForgotPassword ? (
                        <>
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
                                        <div style={{ textAlign: 'right', marginTop: '-10px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setIsForgotPassword(true)}
                                                style={{ background: 'none', border: 'none', color: 'var(--color-sage-dark)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>
                                        <Button type="submit" variant="primary" className="full-width" disabled={isLoading}>
                                            {isLoading ? 'Logging in...' : 'Login'}
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
                                                    placeholder="Email Address"
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
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
                                            // Step 2: Avatar
                                            <>
                                                <AvatarSelector selectedAvatar={avatar} onSelect={setAvatar} />
                                                <div className="form-actions-row">
                                                    <Button type="button" variant="text" onClick={() => setStep(1)}>
                                                        Back
                                                    </Button>
                                                    <Button type="submit" variant="primary" className="flex-1" disabled={isLoading}>
                                                        {isLoading ? 'Creating Account...' : 'Complete Setup'}
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
                                    <Button type="button" variant="text" className="auth-toggle-btn" onClick={toggleMode}>
                                        {isLogin ? 'Register' : 'Login'}
                                    </Button>
                                </div>
                            </form>
                        </>
                    ) : (
                        // FORGOT PASSWORD FLOW
                        <div className="forgot-password-flow">
                            <h2 className="login-subtitle">Reset Password</h2>
                            {error && <div className="login-error">{error}</div>}
                            {successMessage && <div className="login-success" style={{
                                backgroundColor: 'rgba(72, 187, 120, 0.1)',
                                color: 'var(--color-sage-dark)',
                                padding: '10px',
                                borderRadius: '8px',
                                marginBottom: '16px',
                                border: '1px solid rgba(72, 187, 120, 0.3)',
                                fontSize: '14px'
                            }}>{successMessage}</div>}

                            {resetStep === 1 ? (
                                <form onSubmit={handleForgotPasswordRequest} className="login-form">
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                                        Enter your Phone Number to identify your account and an Email Address to receive the OTP.
                                    </p>
                                    <Input
                                        placeholder="Phone Number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        autoFocus
                                    />
                                    <Input
                                        type="email"
                                        placeholder="Email to receive OTP"
                                        value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)}
                                    />
                                    <Button type="submit" variant="primary" className="full-width" disabled={isLoading}>
                                        {isLoading ? 'Sending OTP...' : 'Send OTP'}
                                    </Button>
                                    <Button type="button" variant="text" className="full-width" onClick={() => setIsForgotPassword(false)}>
                                        Back to Login
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleResetPassword} className="login-form">
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                                        Enter the 6-digit OTP sent to <b>{resetEmail}</b> and your new password.
                                    </p>
                                    <Input
                                        placeholder="Enter 6-digit OTP"
                                        value={resetOtp}
                                        onChange={(e) => setResetOtp(e.target.value)}
                                        maxLength={6}
                                        autoFocus
                                    />
                                    <Input
                                        type="password"
                                        placeholder="New Password"
                                        value={newResetPassword}
                                        onChange={(e) => setNewResetPassword(e.target.value)}
                                    />
                                    <Button type="submit" variant="primary" className="full-width" disabled={isLoading}>
                                        {isLoading ? 'Resetting...' : 'Reset & Login'}
                                    </Button>
                                    <Button type="button" variant="text" className="full-width" onClick={() => setResetStep(1)}>
                                        Back
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Right side remains same */}
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
