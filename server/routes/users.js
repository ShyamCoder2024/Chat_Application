const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Search User by Phone
router.get('/search', async (req, res) => {
    const { phone } = req.query;

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const user = await User.findOne({ phone }).select('name phone profilePic bio');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
