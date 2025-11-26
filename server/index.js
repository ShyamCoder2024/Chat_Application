const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const Message = require('./models/Message');
const Chat = require('./models/Chat');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', require('./routes/users'));

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map(); // userId -> Set<socketId>

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('login', (userId) => {
    const id = userId.toString();

    if (!onlineUsers.has(id)) {
      onlineUsers.set(id, new Set());
    }
    const userSockets = onlineUsers.get(id);
    userSockets.add(socket.id);

    console.log(`User logged in: ${id} (Socket: ${socket.id})`);
    console.log(`Active sockets for user ${id}: ${userSockets.size}`);

    // Only emit user_online if this is their first connection
    if (userSockets.size === 1) {
      io.emit('user_online', id);
    }

    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('join_room', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined room ${chatId}`);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.chatId).emit('stop_typing', data);
  });

  socket.on('send_message', async (data) => {
    // data: { chatId, senderId, content }
    try {
      const newMessage = await Message.create(data);

      // Find the chat to get the other user ID
      const chat = await Chat.findById(data.chatId);
      const otherUserId = chat.userIds.find(id => id.toString() !== data.senderId);

      // Update last message and increment unread count for the receiver
      await Chat.findByIdAndUpdate(data.chatId, {
        lastMessage: {
          content: data.content,
          senderId: data.senderId,
          timestamp: newMessage.createdAt
        },
        $inc: { [`unreadCounts.${otherUserId}`]: 1 }
      });

      // 1. Emit to ALL of Sender's sockets (so other devices update)
      const senderId = data.senderId.toString();
      const senderSockets = onlineUsers.get(senderId);
      if (senderSockets) {
        senderSockets.forEach(socketId => {
          io.to(socketId).emit('receive_message', newMessage);
        });
      }

      // 2. Emit to ALL of Receiver's sockets
      const receiverId = otherUserId.toString();
      const receiverSockets = onlineUsers.get(receiverId);

      console.log(`Sending message from ${senderId} to ${receiverId}`);

      if (receiverSockets && receiverSockets.size > 0) {
        console.log(`Receiver has ${receiverSockets.size} active sockets`);
        receiverSockets.forEach(socketId => {
          io.to(socketId).emit('receive_message', newMessage);
        });
      } else {
        console.log(`Receiver ${receiverId} is OFFLINE`);
      }

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find which user this socket belonged to
    for (const [userId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);

        // If no more sockets for this user, they are truly offline
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user_offline', userId);
          console.log(`User truly offline: ${userId}`);
        } else {
          console.log(`User ${userId} still has ${sockets.size} active sockets`);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

// Database Connection and Server Startup
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
