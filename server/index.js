const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const msgpackParser = require("socket.io-msgpack-parser");
require('dotenv').config();

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const User = require('./models/User');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// Trust proxy is required for Render/Heroku deployment
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', require('./routes/users'));

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for deployment
    methods: ["GET", "POST"]
  },
  parser: msgpackParser,
  transports: ['websocket', 'polling'] // Force transports for better compatibility
});

const onlineUsers = new Map(); // userId -> Set<socketId>

io.on('connection', (socket) => {
  // console.log(`User connected: ${socket.id}`);

  socket.on('login', (userId) => {
    const id = userId.toString();

    if (!onlineUsers.has(id)) {
      onlineUsers.set(id, new Set());
    }
    const userSockets = onlineUsers.get(id);
    userSockets.add(socket.id);

    // Only emit user_online if this is their first connection
    if (userSockets.size === 1) {
      io.emit('user_online', id);
    }

    socket.emit('online_users', Array.from(onlineUsers.keys()));
  });

  socket.on('join_room', (chatId) => {
    socket.join(chatId);
  });

  socket.on('typing', (data) => {
    socket.to(data.chatId).emit('typing', data);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.chatId).emit('stop_typing', data);
  });

  socket.on('send_message', async (data) => {
    try {
      if (!data.content || !data.chatId || !data.senderId) {
        console.error('Invalid message data:', data);
        return;
      }

      const [newMessage, chat] = await Promise.all([
        Message.create({
          chatId: data.chatId,
          senderId: data.senderId,
          content: data.content,
          nonce: data.nonce || null
        }),
        Chat.findById(data.chatId)
      ]);

      const otherUserId = chat.userIds.find(id => id.toString() !== data.senderId);

      Chat.findByIdAndUpdate(data.chatId, {
        lastMessage: {
          content: data.content,
          senderId: data.senderId,
          timestamp: newMessage.createdAt,
          nonce: data.nonce || null
        },
        $inc: { [`unreadCounts.${otherUserId}`]: 1 }
      }).catch(err => console.error('Error updating chat metadata:', err));

      const senderId = data.senderId.toString();
      const senderSockets = onlineUsers.get(senderId);
      if (senderSockets) {
        senderSockets.forEach(socketId => {
          io.to(socketId).emit('receive_message', newMessage);
        });
      }

      const receiverId = otherUserId.toString();
      const receiverSockets = onlineUsers.get(receiverId);

      if (receiverSockets && receiverSockets.size > 0) {
        receiverSockets.forEach(socketId => {
          io.to(socketId).emit('receive_message', newMessage);
        });
      }

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  socket.on('message_delivered', async ({ messageId, userId }) => {
    try {
      const message = await Message.findByIdAndUpdate(messageId, { status: 'delivered' }, { new: true });
      if (message) {
        const senderId = message.senderId.toString();
        const senderSockets = onlineUsers.get(senderId);
        if (senderSockets) {
          senderSockets.forEach(socketId => {
            io.to(socketId).emit('message_status_update', { messageId, status: 'delivered' });
          });
        }
      }
    } catch (err) {
      console.error('Error updating delivery status:', err);
    }
  });

  socket.on('message_read', async ({ messageId, userId, chatId }) => {
    try {
      if (messageId) {
        await Message.findByIdAndUpdate(messageId, { status: 'read', read: true });
        const message = await Message.findById(messageId);
        if (message) {
          const senderId = message.senderId.toString();
          const senderSockets = onlineUsers.get(senderId);
          if (senderSockets) {
            senderSockets.forEach(socketId => {
              io.to(socketId).emit('message_status_update', { messageId, status: 'read' });
            });
          }
        }
      } else if (chatId) {
        await Message.updateMany(
          { chatId, senderId: { $ne: userId }, read: false },
          { status: 'read', read: true }
        );
        socket.to(chatId).emit('messages_read_bulk', { chatId, readerId: userId });
      }
    } catch (err) {
      console.error('Error updating read status:', err);
    }
  });

  socket.on('add_reaction', async ({ messageId, userId, emoji }) => {
    try {
      const message = await Message.findById(messageId);
      if (message) {
        const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId);
        if (existingReactionIndex > -1) {
          message.reactions.splice(existingReactionIndex, 1);
        }
        message.reactions.push({ userId, emoji });
        await message.save();
        io.to(message.chatId.toString()).emit('reaction_updated', { messageId, reactions: message.reactions });
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(err => console.error('Error updating lastSeen:', err));
          io.emit('user_offline', userId);
        }
        break;
      }
    }
  });
});

// Database Connection and Server Startup
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 50,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
