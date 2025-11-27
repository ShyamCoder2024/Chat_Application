const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    userIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    lastMessage: {
        content: String,
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: Date,
        nonce: { type: String, default: null }
    },
    unreadCounts: {
        type: Map,
        of: Number,
        default: {}
    }
}, { timestamps: true });

// Index for finding chats by user
chatSchema.index({ userIds: 1 });

module.exports = mongoose.model('Chat', chatSchema);
