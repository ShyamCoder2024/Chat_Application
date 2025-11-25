const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        content: String,
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: Date
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('Chat', chatSchema);
