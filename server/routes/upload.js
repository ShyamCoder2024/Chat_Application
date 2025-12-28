const express = require('express');
const router = express.Router();
const multer = require('multer');
const Media = require('../models/Media');
const { isValidObjectId } = require('../middleware/sanitize');

// Configure storage (Memory Storage for Database)
const storage = multer.memoryStorage();

// File filter with better validation
const fileFilter = (req, file, cb) => {
    // Accept images and audio
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/mp3'
    ];

    if (allowedMimeTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only images and audio are allowed.`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: 'File too large. Maximum size is 10MB.',
                retryable: false
            });
        }
        return res.status(400).json({
            error: `Upload error: ${err.message}`,
            retryable: true
        });
    } else if (err) {
        return res.status(400).json({
            error: err.message,
            retryable: true
        });
    }
    next();
};

// Upload route with extended timeout and better error handling
router.post('/', (req, res, next) => {
    // Set extended timeout for uploads (2 minutes)
    req.setTimeout(120000);
    res.setTimeout(120000);
    next();
}, upload.single('file'), handleMulterError, async (req, res) => {
    const startTime = Date.now();

    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded',
                retryable: true
            });
        }

        // Validate file before saving
        if (!req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                error: 'Empty file received',
                retryable: true
            });
        }

        // Create new Media document
        const newMedia = new Media({
            filename: req.file.originalname || `file-${Date.now()}`,
            contentType: req.file.mimetype,
            data: req.file.buffer,
            size: req.file.size
        });

        const savedMedia = await newMedia.save();

        // Return the file URL pointing to our serve route
        const fileUrl = `/api/upload/file/${savedMedia._id}`;

        const uploadTime = Date.now() - startTime;
        console.log(`Upload completed: ${savedMedia.filename} (${savedMedia.size} bytes) in ${uploadTime}ms`);

        res.json({
            success: true,
            url: fileUrl,
            filename: savedMedia.filename,
            mimetype: savedMedia.contentType,
            size: savedMedia.size,
            uploadTime: uploadTime
        });
    } catch (err) {
        console.error("Upload error:", err);

        // Determine if error is retryable
        const isRetryable = !err.message.includes('validation') &&
            !err.message.includes('Invalid');

        res.status(500).json({
            error: `Upload failed: ${err.message}`,
            retryable: isRetryable
        });
    }
});

// Serve file route with caching
router.get('/file/:id', async (req, res) => {
    try {
        // Validate ObjectId
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid file ID' });
        }

        const media = await Media.findById(req.params.id).lean();

        if (!media) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Set cache headers for better performance
        res.set('Cache-Control', 'public, max-age=31536000'); // 1 year (files don't change)
        res.set('Content-Type', media.contentType);
        res.set('Content-Length', media.size);
        res.set('Content-Disposition', `inline; filename="${media.filename}"`);
        // CORS headers for media files
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');

        res.send(media.data);
    } catch (err) {
        console.error("File retrieval error:", err);
        res.status(500).json({ error: 'Failed to retrieve file' });
    }
});

// Health check for upload service
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'upload' });
});

module.exports = router;
