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
const uploadRoutes = require('./routes/upload');
const path = require('path');
const { sanitizeMiddleware } = require('./middleware/sanitize');

const PORT = process.env.PORT || 3000;
// Force redeploy v3 - Validation fix

const app = express();
const server = http.createServer(app);

// Trust proxy is required for Render/Heroku deployment
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input Sanitization - Apply to all routes
app.use(sanitizeMiddleware);

// Request Timeout Middleware (30 seconds for normal requests)
app.use((req, res, next) => {
  // Skip timeout for upload routes (handled separately)
  if (req.path.startsWith('/api/upload')) {
    return next();
  }
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Rate Limiting - More generous for legitimate users
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Increased from 100 to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', limiter);

// Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', require('./routes/users'));
app.use('/api/upload', uploadRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.io Setup - Optimized for 10k+ concurrent users
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  parser: msgpackParser,
  transports: ['websocket', 'polling'],
  // Performance optimizations
  pingTimeout: 60000, // 60 seconds - more forgiving for mobile
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 30000, // 30 seconds to upgrade to websocket
  maxHttpBufferSize: 1e6, // 1 MB max message size
  // Connection state recovery for reconnections
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  // Adapter settings for better memory management
  perMessageDeflate: {
    threshold: 1024, // Only compress messages > 1KB
  }
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
    console.log(`Socket ${socket.id} joined room ${chatId}`);
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
      console.log("Server received send_message:", data);
      if (!data.content || !data.chatId || !data.senderId) {
        console.error('Invalid message data:', data);
        return;
      }

      console.log(`Processing message from ${data.senderId} in chat ${data.chatId}`);

      const [newMessage, chat] = await Promise.all([
        Message.create({
          chatId: data.chatId,
          senderId: data.senderId,
          content: data.content,
          nonce: data.nonce || null,
          type: data.type || 'text',
          mediaUrl: data.mediaUrl || null
        }),
        Chat.findById(data.chatId)
      ]);

      if (!chat) {
        console.error(`Chat not found: ${data.chatId}`);
        return;
      }

      const otherUserId = chat.userIds.find(id => id.toString() !== data.senderId);

      Chat.findByIdAndUpdate(data.chatId, {
        lastMessage: {
          content: data.content,
          senderId: data.senderId,
          timestamp: newMessage.createdAt,
          nonce: data.nonce || null,
          type: data.type || 'text'
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
      } else {
        console.log(`User ${receiverId} is offline. Message saved.`);
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
