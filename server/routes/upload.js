const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media');

// Configure storage (Memory Storage for Database)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images and audio
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4'
    ];

    if (allowedMimeTypes.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images and audio are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Upload route
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create new Media document
        const newMedia = new Media({
            filename: req.file.originalname,
            contentType: req.file.mimetype,
            data: req.file.buffer,
            size: req.file.size
        });

        const savedMedia = await newMedia.save();

        // Return the file URL pointing to our serve route
        // /api/upload/file/:id
        const fileUrl = `/api/upload/file/${savedMedia._id}`;

        res.json({
            url: fileUrl,
            filename: savedMedia.filename,
            mimetype: savedMedia.contentType,
            size: savedMedia.size
        });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Serve file route
router.get('/file/:id', async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);

        if (!media) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.set('Content-Type', media.contentType);
        res.set('Content-Disposition', `inline; filename="${media.filename}"`);
        res.send(media.data);
    } catch (err) {
        console.error("File retrieval error:", err);
        res.status(500).json({ error: 'Failed to retrieve file' });
    }
});

module.exports = router;
