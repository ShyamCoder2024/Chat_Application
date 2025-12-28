/**
 * Input Sanitization Middleware
 * Protects against XSS, NoSQL injection, and validates common input types
 */

// Sanitize string - trim whitespace and escape HTML entities
const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
        .replace(/\$/g, '') // Remove $ to prevent NoSQL injection
        .replace(/\{|\}/g, ''); // Remove {} to prevent object injection
};

// Recursively sanitize all string values in an object
const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key of Object.keys(obj)) {
            // Skip ObjectId-like fields
            if (key === '_id' || key.endsWith('Id') || key === 'id') {
                sanitized[key] = obj[key];
            } else {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    return obj;
};

// Validate MongoDB ObjectId format
const isValidObjectId = (id) => {
    if (!id) return false;
    return /^[a-fA-F0-9]{24}$/.test(id.toString());
};

// Validate phone number (basic validation - digits only, 10-15 chars)
const isValidPhone = (phone) => {
    if (!phone) return false;
    const cleaned = phone.toString().replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
};

// Validate email format
const isValidEmail = (email) => {
    if (!email) return true; // Email is optional in this app
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Main sanitization middleware
const sanitizeMiddleware = (req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }

    // Sanitize query params
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }

    // Sanitize URL params
    if (req.params && typeof req.params === 'object') {
        req.params = sanitizeObject(req.params);
    }

    next();
};

// Validation helpers for routes
const validateObjectId = (id, fieldName = 'ID') => {
    if (!isValidObjectId(id)) {
        const error = new Error(`Invalid ${fieldName} format`);
        error.status = 400;
        throw error;
    }
    return true;
};

const validatePhone = (phone) => {
    if (!isValidPhone(phone)) {
        const error = new Error('Invalid phone number format');
        error.status = 400;
        throw error;
    }
    return true;
};

const validateEmail = (email) => {
    if (email && !isValidEmail(email)) {
        const error = new Error('Invalid email format');
        error.status = 400;
        throw error;
    }
    return true;
};

const validateRequired = (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
        const error = new Error(`${fieldName} is required`);
        error.status = 400;
        throw error;
    }
    return true;
};

module.exports = {
    sanitizeMiddleware,
    sanitizeString,
    sanitizeObject,
    isValidObjectId,
    isValidPhone,
    isValidEmail,
    validateObjectId,
    validatePhone,
    validateEmail,
    validateRequired
};
