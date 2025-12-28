/**
 * Centralized API Service
 * Provides unified fetch wrapper with timeout, retry, and error handling
 */

import { API_URL } from '../config';

// Default configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds for normal requests
const UPLOAD_TIMEOUT = 120000; // 2 minutes for uploads
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

/**
 * Sleep helper for retry delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw error;
    }
};

/**
 * Parse error response
 */
const parseErrorResponse = async (response) => {
    try {
        const data = await response.json();
        return data.error || data.message || `Request failed with status ${response.status}`;
    } catch {
        return `Request failed with status ${response.status}`;
    }
};

/**
 * Main API request function with retry logic
 */
export const apiRequest = async (endpoint, options = {}, config = {}) => {
    const {
        timeout = DEFAULT_TIMEOUT,
        retries = MAX_RETRIES,
        retryOn = [408, 429, 500, 502, 503, 504], // Status codes to retry on
        skipRetry = false
    } = config;

    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

    // Default headers for JSON
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Don't set Content-Type for FormData (let browser set it with boundary)
    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const fetchOptions = {
        ...options,
        headers
    };

    let lastError;
    let lastResponse;

    for (let attempt = 0; attempt <= (skipRetry ? 0 : retries); attempt++) {
        try {
            const response = await fetchWithTimeout(url, fetchOptions, timeout);

            if (response.ok) {
                return response;
            }

            lastResponse = response;
            lastError = await parseErrorResponse(response);

            // Check if we should retry this status code
            if (!retryOn.includes(response.status) || attempt === retries) {
                break;
            }

            // Exponential backoff
            const delay = RETRY_DELAY * Math.pow(2, attempt);
            console.log(`Request failed (${response.status}), retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
            await sleep(delay);

        } catch (error) {
            lastError = error.message;

            // Network errors are retryable
            if (attempt === retries || skipRetry) {
                break;
            }

            const delay = RETRY_DELAY * Math.pow(2, attempt);
            console.log(`Network error, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
            await sleep(delay);
        }
    }

    // Create a custom error with additional info
    const error = new Error(lastError);
    error.response = lastResponse;
    throw error;
};

/**
 * GET request helper
 */
export const get = async (endpoint, config = {}) => {
    const response = await apiRequest(endpoint, { method: 'GET' }, config);
    return response.json();
};

/**
 * POST request helper
 */
export const post = async (endpoint, data, config = {}) => {
    const response = await apiRequest(
        endpoint,
        {
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data)
        },
        config
    );
    return response.json();
};

/**
 * PUT request helper
 */
export const put = async (endpoint, data, config = {}) => {
    const response = await apiRequest(
        endpoint,
        {
            method: 'PUT',
            body: JSON.stringify(data)
        },
        config
    );
    return response.json();
};

/**
 * DELETE request helper
 */
export const del = async (endpoint, config = {}) => {
    const response = await apiRequest(endpoint, { method: 'DELETE' }, config);
    return response.json();
};

/**
 * File upload with progress callback
 */
export const uploadFile = async (file, onProgress = null) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        // Set up progress handler
        if (onProgress && xhr.upload) {
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            });
        }

        // Set up completion handlers
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Invalid response from server'));
                }
            } else {
                try {
                    const error = JSON.parse(xhr.responseText);
                    reject(new Error(error.error || 'Upload failed'));
                } catch (e) {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
            reject(new Error('Upload cancelled'));
        });

        xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timed out'));
        });

        // Configure and send
        xhr.open('POST', `${API_URL}/api/upload`);
        xhr.timeout = UPLOAD_TIMEOUT;
        xhr.send(formData);
    });
};

export default {
    get,
    post,
    put,
    del,
    uploadFile,
    apiRequest
};
