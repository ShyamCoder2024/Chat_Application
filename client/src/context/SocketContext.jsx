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
    const [reconnectAttempt, setReconnectAttempt] = useState(0);

    useEffect(() => {
        if (user) {
            const newSocket = io(API_URL, {
                parser: msgpackParser,
                transports: ['polling', 'websocket'], // Start with polling for better initial connection
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 10000, // Max 10 seconds between retries
                randomizationFactor: 0.5,
                timeout: 30000, // 30 seconds connection timeout
                // Performance optimizations
                forceNew: false,
                multiplex: true,
            });
            setSocket(newSocket);

            const handleConnect = () => {
                console.log("Socket connected, logging in...");
                setIsConnected(true);
                setReconnectAttempt(0);
                newSocket.emit('login', user._id.toString());
            };

            const handleDisconnect = (reason) => {
                console.log("Socket disconnected:", reason);
                setIsConnected(false);
                // Auto-reconnect for server-initiated disconnects
                if (reason === "io server disconnect" || reason === "transport close") {
                    setTimeout(() => {
                        if (!newSocket.connected) {
                            newSocket.connect();
                        }
                    }, 1000);
                }
            };

            const handleReconnectAttempt = (attempt) => {
                setReconnectAttempt(attempt);
                console.log(`Reconnection attempt ${attempt}...`);
            };

            const handleError = (error) => {
                console.error("Socket error:", error);
            };

            newSocket.on('connect', handleConnect);
            newSocket.on('disconnect', handleDisconnect);
            newSocket.on('reconnect_attempt', handleReconnectAttempt);
            newSocket.on('error', handleError);

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

            newSocket.on('receive_message', (message) => {
                // Notifications are handled in ChatLayout
            });

            return () => {
                newSocket.off('connect', handleConnect);
                newSocket.off('disconnect', handleDisconnect);
                newSocket.off('reconnect_attempt', handleReconnectAttempt);
                newSocket.off('error', handleError);
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
        <SocketContext.Provider value={{ socket, onlineUsers, isConnected, reconnectAttempt }}>
            {children}
        </SocketContext.Provider>
    );
};


