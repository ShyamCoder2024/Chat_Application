const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cluster = require('cluster');
// Limit to 4 workers max for free tier compatibility, or use available cores if less
const numCPUs = Math.min(require('os').cpus().length, 4);
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const msgpackParser = require("socket.io-msgpack-parser");
require('dotenv').config();

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const User = require('./models/User');

const PORT = process.env.PORT || 3000;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);

  const httpServer = http.createServer();

  // Setup sticky sessions
  setupMaster(httpServer, {
    loadBalancingMethod: "least-connection",
  });

  // Setup cluster adapter
  setupPrimary();

  httpServer.listen(PORT, () => {
    console.log(`Master listening on port ${PORT}`);
  });

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  console.log(`Worker ${process.pid} started`);

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
    adapter: createAdapter()
  });

  // Setup worker for sticky sessions
  setupWorker(io);

  const onlineUsers = new Map(); // userId -> Set<socketId>

  io.on('connection', (socket) => {
    // console.log(`User connected: ${socket.id} on worker ${process.pid}`);

    socket.on('login', (userId) => {
      const id = userId.toString();

      if (!onlineUsers.has(id)) {
        onlineUsers.set(id, new Set());
      }
      const userSockets = onlineUsers.get(id);
      userSockets.add(socket.id);

      // console.log(`User logged in: ${id} (Socket: ${socket.id})`);

      // Only emit user_online if this is their first connection
      if (userSockets.size === 1) {
        io.emit('user_online', id);
      }

      socket.emit('online_users', Array.from(onlineUsers.keys()));
    });

    socket.on('join_room', (chatId) => {
      socket.join(chatId);
      // console.log(`User ${socket.id} joined room ${chatId}`);
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
        // Parallelize DB operations
        // Parallelize DB operations
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

        // Update last message and increment unread count for the receiver
        // This can run in background, no need to await for socket emission
        Chat.findByIdAndUpdate(data.chatId, {
          lastMessage: {
            content: data.content,
            senderId: data.senderId,
            timestamp: newMessage.createdAt
          },
          $inc: { [`unreadCounts.${otherUserId}`]: 1 }
        }).catch(err => console.error('Error updating chat metadata:', err));

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

        // console.log(`Sending message from ${senderId} to ${receiverId}`);

        if (receiverSockets && receiverSockets.size > 0) {
          // console.log(`Receiver has ${receiverSockets.size} active sockets`);
          receiverSockets.forEach(socketId => {
            io.to(socketId).emit('receive_message', newMessage);
          });
        } else {
          // console.log(`Receiver ${receiverId} is OFFLINE`);
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
        // Update specific message or all unread messages in chat
        if (messageId) {
          await Message.findByIdAndUpdate(messageId, { status: 'read', read: true });
          // Notify sender
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
          // Mark all messages in chat as read
          await Message.updateMany(
            { chatId, senderId: { $ne: userId }, read: false },
            { status: 'read', read: true }
          );
          // Notify sender (broadcasting to chat room might be easier here, or find sender)
          // For simplicity, we'll rely on the existing 'read' endpoint logic or client refresh for bulk updates
          // But let's emit a bulk event to the room
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
          // Remove existing reaction from this user if any
          const existingReactionIndex = message.reactions.findIndex(r => r.userId.toString() === userId);
          if (existingReactionIndex > -1) {
            message.reactions.splice(existingReactionIndex, 1);
          }
          // Add new reaction
          message.reactions.push({ userId, emoji });
          await message.save();

          // Broadcast to chat participants
          // We need to find the chat to know who to notify, or just notify sender + receiver
          // A simpler way is to emit to the chat room if we had rooms for chats.
          // We do have `join_room`! So we can emit to the room.
          io.to(message.chatId.toString()).emit('reaction_updated', { messageId, reactions: message.reactions });
        }
      } catch (err) {
        console.error('Error adding reaction:', err);
      }
    });

    socket.on('disconnect', () => {
      // console.log(`User disconnected: ${socket.id}`);

      // Find which user this socket belonged to
      for (const [userId, sockets] of onlineUsers.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);

          // If no more sockets for this user, they are truly offline
          if (sockets.size === 0) {
            onlineUsers.delete(userId);

            // Update lastSeen in DB
            User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(err => console.error('Error updating lastSeen:', err));

            io.emit('user_offline', userId);
            // console.log(`User truly offline: ${userId}`);
          } else {
            // console.log(`User ${userId} still has ${sockets.size} active sockets`);
          }
          break;
        }
      }
    });
  });

  // Database Connection and Server Startup
  mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 50, // Increase connection pool size for high concurrency
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
    .then(() => {
      console.log(`Worker ${process.pid} connected to MongoDB`);
      // Note: We do NOT call server.listen() here because setupMaster handles the listening
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
}
