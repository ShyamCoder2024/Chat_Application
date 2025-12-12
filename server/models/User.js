const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false, // Optional for backward compatibility but needed for reset
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true
    },
    otp: {
        type: String,
        select: false
    },
    otpExpires: {
        type: Date,
        select: false
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    name: { // Legacy field for backward compatibility
        type: String
    },
    bio: {
        type: String,
        default: ''
    },
    profilePic: {
        type: String,
        default: ''
    },
    publicKey: {
        type: String,
        default: ''
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    encryptedPrivateKey: {
        type: String, // Encrypted Secret Key for Sync
        default: null
    },
    iv: {
        type: String, // Initialization Vector for Encryption
        default: null
    },
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

userSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('User', userSchema);
