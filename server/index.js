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

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('login', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('user_online', userId);
    // Send list of currently online users to the new user
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
      await Chat.findByIdAndUpdate(data.chatId, {
        lastMessage: {
          content: data.content,
          senderId: data.senderId,
          timestamp: newMessage.createdAt
        }
      });

      io.to(data.chatId).emit('receive_message', newMessage);
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    // Find userId by socketId
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit('user_offline', userId);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
