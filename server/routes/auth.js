const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
// Register
router.post('/register', async (req, res) => {
    const { phone, password, firstName, lastName, profilePic, publicKey, email } = req.body;

    if (!phone || !password || !firstName || !lastName) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        if (email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }

        const user = await User.create({
            phone,
            password,
            firstName,
            lastName,
            email: email || undefined, // Allow sparse
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
                firstName: 'Clara',
                lastName: '(AI)',
                bio: 'I am here to help you get started!',
                profilePic: 'https://api.dicebear.com/7.x/bottts/svg?seed=Clara'
            });
        }

        const Chat = require('../models/Chat');

        const welcomeChat = await Chat.create({
            userIds: [user._id, demoUser._id],
            lastMessage: {
                content: "Welcome to MeetPune! I'm Clara, your AI assistant. Feel free to test the chat with me.",
                senderId: demoUser._id,
                timestamp: new Date()
            }
        });

        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const crypto = require('crypto');
const sendEmail = require('../utils/email');

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
    const { phone, email } = req.body;
    if (!phone || !email) return res.status(400).json({ error: 'Please provide both phone number and email address' });

    try {
        // 1. Find User by Phone (Identity)
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this phone number' });
        }

        // 2. Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Use updateOne to bypass validation for legacy users missing required fields
        await User.updateOne(
            { _id: user._id },
            { $set: { otp, otpExpires } }
        );

        // 3. Send OTP to the provided Email (Delivery) - ignoring DB email
        const message = `Your Password Reset OTP for MeetPune matches with phone ${phone}.\n\nOTP: ${otp}\n\nValid for 10 minutes.`;

        try {
            await sendEmail({
                email: email, // Use the email provided in request
                subject: 'MeetPune Password Reset OTP',
                message
            });

            res.status(200).json({ message: 'OTP sent to your email!' });
        } catch (err) {
            // Revert OTP if email fails
            await User.updateOne(
                { _id: user._id },
                { $unset: { otp: 1, otpExpires: 1 } }
            );
            return res.status(500).json({ error: 'Failed to send email. Checks logs or try again.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Password - Verify OTP & Set Password
router.post('/reset-password', async (req, res) => {
    const { phone, otp, password } = req.body;

    if (!phone || !otp || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Find by phone
        const user = await User.findOne({ phone }).select('+otp +otpExpires');

        if (!user || user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Use updateOne to bypass validation (since this is legacy data support)
        // password is plain text so direct update is safe (per existing architecture)
        await User.updateOne(
            { _id: user._id },
            {
                $set: { password: password },
                $unset: { otp: 1, otpExpires: 1 }
            }
        );

        // Fetch updated user for response if needed (or just send success)
        const updatedUser = await User.findById(user._id);

        res.status(200).json({ message: 'Password reset successful!', user: updatedUser });

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
