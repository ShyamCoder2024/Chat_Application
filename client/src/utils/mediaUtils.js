import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file.
 * @param {File} file - The image file to compress.
 * @returns {Promise<File>} - The compressed image file.
 */
export const compressImage = async (file) => {
    // Options for compression
    const options = {
        maxSizeMB: 0.8,          // Compress to ~800KB or less
        maxWidthOrHeight: 1920,  // Resize large images
        useWebWorker: true,
        fileType: 'image/jpeg'   // Convert to JPEG for better compression
    };

    try {
        console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const compressedFile = await imageCompression(file, options);
        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        return compressedFile;
    } catch (error) {
        console.error("Image compression failed:", error);
        // Return original file if compression fails
        return file;
    }
};
