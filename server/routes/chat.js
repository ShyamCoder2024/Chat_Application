const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

// Create or Get Chat
router.post('/', async (req, res) => {
    const { currentUserId, targetPhone } = req.body;

    try {
        const targetUser = await User.findOne({ phone: targetPhone });
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        let chat = await Chat.findOne({
            userIds: { $all: [currentUserId, targetUser._id] }
        });

        if (!chat) {
            chat = await Chat.create({
                userIds: [currentUserId, targetUser._id]
            });
        }

        const populatedChat = await Chat.findById(chat._id).populate('userIds', 'name phone profilePic lastSeen');
        res.json(populatedChat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Chats for User
router.get('/:userId', async (req, res) => {
    try {
        const chats = await Chat.find({
            userIds: { $in: [req.params.userId] }
        })
            .populate('userIds', 'name phone profilePic lastSeen')
            .sort({ updatedAt: -1 });

        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Messages
router.get('/:chatId/messages', async (req, res) => {
    try {
        const messages = await Message.find({ chatId: req.params.chatId }).sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Clear Chat
router.delete('/:chatId/messages', async (req, res) => {
    try {
        await Message.deleteMany({ chatId: req.params.chatId });
        await Chat.findByIdAndUpdate(req.params.chatId, {
            lastMessage: null
        });
        res.json({ message: 'Chat cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Block User
router.post('/block', async (req, res) => {
    const { userId, blockUserId } = req.body;
    try {
        await User.findByIdAndUpdate(userId, {
            $addToSet: { blockedUsers: blockUserId }
        });
        res.json({ message: 'User blocked' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark Chat as Read
router.put('/:chatId/read', async (req, res) => {
    const { userId } = req.body;
    try {
        await Chat.findByIdAndUpdate(req.params.chatId, {
            [`unreadCounts.${userId}`]: 0
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
