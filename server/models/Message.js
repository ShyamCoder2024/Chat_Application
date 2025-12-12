const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true,
        default: '' // Make content optional for media messages
    },
    type: {
        type: String,
        enum: ['text', 'image', 'audio'],
        default: 'text'
    },
    mediaUrl: {
        type: String,
        default: null
    },
    nonce: {
        type: String, // For E2EE
        default: null
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emoji: String
    }],
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Index for automatic deletion after 24 hours (86400 seconds)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
// Compound index for fetching chat history efficiently
messageSchema.index({ chatId: 1, createdAt: -1 });
// Index for finding messages by sender
messageSchema.index({ senderId: 1 });

module.exports = mongoose.model('Message', messageSchema);
