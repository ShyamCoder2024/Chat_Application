import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        if (user) {
            const newSocket = io('http://localhost:3000');
            setSocket(newSocket);

            newSocket.emit('login', user._id);

            newSocket.on('online_users', (users) => {
                setOnlineUsers(new Set(users));
            });

            newSocket.on('user_online', (userId) => {
                setOnlineUsers(prev => new Set(prev).add(userId));
            });

            newSocket.on('user_offline', (userId) => {
                setOnlineUsers(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(userId);
                    return newSet;
                });
            });

            return () => newSocket.close();
        } else {
            if (socket) socket.close();
        }
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
