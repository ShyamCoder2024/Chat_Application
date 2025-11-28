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

    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (user) {
            const newSocket = io(API_URL, {
                parser: msgpackParser,
                transports: ['polling', 'websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity, // Keep trying to reconnect
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });
            setSocket(newSocket);

            const handleConnect = () => {
                console.log("Socket connected, logging in...");
                setIsConnected(true);
                newSocket.emit('login', user._id.toString());
            };

            const handleDisconnect = (reason) => {
                console.log("Socket disconnected:", reason);
                setIsConnected(false);
                if (reason === "io server disconnect") {
                    // the disconnection was initiated by the server, you need to reconnect manually
                    newSocket.connect();
                }
            };

            newSocket.on('connect', handleConnect);
            newSocket.on('disconnect', handleDisconnect);

            // Emit immediately in case already connected
            if (newSocket.connected) {
                handleConnect();
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

            return () => {
                newSocket.off('connect', handleConnect);
                newSocket.off('disconnect', handleDisconnect);
                newSocket.close();
            };
        } else {
            if (socket) {
                socket.close();
                setSocket(null);
                setIsConnected(false);
            }
        }
    }, [user]);

    return (
        <SocketContext.Provider value={{ socket, onlineUsers, isConnected }}>
            {children}
        </SocketContext.Provider>
    );
};


