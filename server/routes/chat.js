const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { isValidObjectId, validatePhone } = require('../middleware/sanitize');

// Create or Get Chat
router.post('/', async (req, res) => {
    const { currentUserId, targetPhone } = req.body;

    // Validate inputs
    if (!currentUserId || !isValidObjectId(currentUserId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    if (!targetPhone) {
        return res.status(400).json({ error: 'Target phone is required' });
    }

    try {
        const targetUser = await User.findOne({ phone: targetPhone }).lean();
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Ensure ObjectIds are used for query
        const mongoose = require('mongoose');
        const currentId = new mongoose.Types.ObjectId(currentUserId);
        const targetId = targetUser._id;

        // Sort userIds to ensure consistency
        const userIds = [currentId, targetId].sort();

        let chat = await Chat.findOne({
            userIds: { $all: userIds }
        }).lean();

        if (!chat) {
            chat = await Chat.create({
                userIds: userIds
            });
        }

        const populatedChat = await Chat.findById(chat._id)
            .populate('userIds', 'firstName lastName name phone profilePic lastSeen publicKey')
            .lean();
        res.json(populatedChat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get All Chats for User
router.get('/:userId', async (req, res) => {
    try {
        // Validate userId
        if (!isValidObjectId(req.params.userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const currentUser = await User.findById(req.params.userId);
        const blockedUserIds = new Set(currentUser.blockedUsers.map(id => id.toString()));

        const chats = await Chat.find({
            userIds: { $in: [req.params.userId] }
        })
            .populate('userIds', 'firstName lastName name phone profilePic lastSeen publicKey')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // Deduplicate chats based on other user ID
        const uniqueChats = [];
        const seenUserIds = new Set();

        for (const chat of chats) {
            const otherUser = chat.userIds.find(u => u._id.toString() !== req.params.userId);
            if (otherUser) {
                // Skip if this user is blocked
                if (blockedUserIds.has(otherUser._id.toString())) {
                    continue;
                }

                if (!seenUserIds.has(otherUser._id.toString())) {
                    seenUserIds.add(otherUser._id.toString());
                    uniqueChats.push(chat);
                }
            } else {
                // Keep chat if other user not found (shouldn't happen often)
                uniqueChats.push(chat);
            }
        }

        res.json(uniqueChats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Chat
router.get('/single/:chatId', async (req, res) => {
    try {
        // Validate chatId
        if (!isValidObjectId(req.params.chatId)) {
            return res.status(400).json({ error: 'Invalid chat ID' });
        }

        const chat = await Chat.findById(req.params.chatId)
            .populate('userIds', 'firstName lastName name phone profilePic lastSeen publicKey')
            .lean();
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Messages
router.get('/:chatId/messages', async (req, res) => {
    try {
        const { limit = 100, before } = req.query;
        const query = { chatId: req.params.chatId };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 }) // Sort by newest first for pagination
            .limit(parseInt(limit))
            .lean();

        // Reverse back to oldest first for display
        res.json(messages.reverse());
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

// Unblock User
router.post('/unblock', async (req, res) => {
    const { userId, blockUserId } = req.body;
    try {
        await User.findByIdAndUpdate(userId, {
            $pull: { blockedUsers: blockUserId }
        });
        res.json({ message: 'User unblocked' });
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
        }, { timestamps: false });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
