import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('btween_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (phone, password) => {
        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setUser(data.user);
            localStorage.setItem('btween_user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            throw err;
        }
    };

    const register = async (phone, password, name, profilePic) => {
        try {
            const response = await fetch('http://localhost:3000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password, name, profilePic })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setUser(data.user);
            localStorage.setItem('btween_user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            throw err;
        }
    };

    const updateProfile = async (updates) => {
        try {
            const response = await fetch(`http://localhost:3000/api/auth/profile/${user._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            setUser(data.user);
            localStorage.setItem('btween_user', JSON.stringify(data.user));
            return data.user;
        } catch (err) {
            throw err;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('btween_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, updateProfile, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
