import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import msgpackParser from 'socket.io-msgpack-parser';
import { useAuth } from './AuthContext';
import { API_URL } from '../config';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();
    const [onlineUsers, setOnlineUsers] = useState(new Set());

    useEffect(() => {
        if (user) {
            const newSocket = io(API_URL, {
                parser: msgpackParser
            });
            setSocket(newSocket);

            newSocket.on('connect', () => {
                console.log("Socket connected, logging in...");
                newSocket.emit('login', user._id.toString());
            });

            // Emit immediately in case already connected (though unlikely with new socket)
            if (newSocket.connected) {
                newSocket.emit('login', user._id.toString());
            }

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


