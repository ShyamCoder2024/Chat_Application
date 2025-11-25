const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
    const { phone, password, name, profilePic } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required' });
    }

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        const user = await User.create({
            phone,
            password,
            name,
            profilePic: profilePic || ''
        });

        // Create welcome chat for new user
        const demoPhone = '0000000000';
        let demoUser = await User.findOne({ phone: demoPhone });

        if (!demoUser) {
            demoUser = await User.create({
                phone: demoPhone,
                password: 'demo',
                name: 'Clara (AI)',
                bio: 'I am here to help you get started!',
                profilePic: 'https://api.dicebear.com/7.x/bottts/svg?seed=Clara'
            });
        }

        const Chat = require('../models/Chat');
        const Message = require('../models/Message');

        // Create Welcome Chat with Clara
        const clara = await User.findOne({ phone: '0000000000' });
        if (clara) {
            const welcomeChat = await Chat.create({
                userIds: [user._id, clara._id],
                lastMessage: {
                    content: "Welcome to MeetPune! I'm Clara, your AI assistant. Feel free to test the chat with me.",
                    senderId: clara._id,
                    timestamp: new Date()
                }
            });
        }

        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required' });
    }

    try {
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        if (user.password !== password) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile
router.put('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.userId,
            req.body,
            { new: true }
        );
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
