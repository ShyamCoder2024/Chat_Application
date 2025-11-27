const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
    const { phone, password, firstName, lastName, profilePic, publicKey } = req.body;

    if (!phone || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        const user = await User.create({
            phone,
            password,
            firstName,
            lastName,
            profilePic: profilePic || '',
            publicKey: publicKey || '',
            encryptedPrivateKey: req.body.encryptedPrivateKey || null,
            iv: req.body.iv || null
        });

        // Create welcome chat for new user
        const demoPhone = '0000000000';
        let demoUser = await User.findOne({ phone: demoPhone });

        if (!demoUser) {
            demoUser = await User.create({
                phone: demoPhone,
                password: 'demo',
                password: 'demo',
                firstName: 'Clara',
                lastName: '(AI)',
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
            { new: true, runValidators: true }
        );
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Blocked Users
router.get('/blocked/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('blockedUsers', 'firstName lastName name phone profilePic');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.blockedUsers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
