/**
 * Instagram Router for Unified Server
 * Wraps the existing Instagram scraper and handlers
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Import from ProjectDownloaderIG
const IG_PATH = path.join(__dirname, '..', 'ProjectDownloaderIG');
const { scrapeInstagramPost, isValidInstagramUrl } = require(path.join(IG_PATH, 'scraper'));
const browserManager = require(path.join(IG_PATH, 'browser-manager'));
const rateLimiter = require(path.join(IG_PATH, 'rate-limiter'));
const errorRecovery = require(path.join(IG_PATH, 'error-recovery'));
const downloadQueue = require(path.join(IG_PATH, 'download-queue'));

const COOKIES_PATH = path.join(IG_PATH, 'cookies.json');
const DEFAULT_DOWNLOAD_FOLDER = process.env.DOWNLOAD_PATH || path.join(require('os').homedir(), 'Downloads', 'Instagram');

/**
 * POST /download - Download Instagram media
 */
router.post('/download', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL diperlukan',
                code: 'MISSING_URL'
            });
        }

        if (!isValidInstagramUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'URL tidak valid. Masukkan URL postingan Instagram yang benar.',
                code: 'INVALID_URL'
            });
        }

        console.log('[Instagram] Processing:', url);
        const result = await scrapeInstagramPost(url);

        if (result.success) {
            console.log(`[Instagram] Extracted ${result.count} media items`);
            return res.json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error('[Instagram] Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan server. Silakan coba lagi.',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /set-cookies - Save Instagram cookies
 */
router.post('/set-cookies', async (req, res) => {
    try {
        const { cookies } = req.body;

        if (!cookies || !Array.isArray(cookies)) {
            return res.status(400).json({
                success: false,
                error: 'Cookies array diperlukan'
            });
        }

        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        if (!sessionCookie || !sessionCookie.value) {
            return res.status(400).json({
                success: false,
                error: 'Session cookie tidak ditemukan'
            });
        }

        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log(`[Instagram] Cookies saved: ${cookies.length} cookies`);

        res.json({
            success: true,
            message: 'Cookies saved successfully',
            count: cookies.length
        });

    } catch (error) {
        console.error('[Instagram] Set cookies error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save cookies: ' + error.message
        });
    }
});

/**
 * GET /cookie-status - Check cookie status
 */
router.get('/cookie-status', (req, res) => {
    try {
        if (!fs.existsSync(COOKIES_PATH)) {
            return res.json({ loggedIn: false, message: 'No cookies file' });
        }

        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const userCookie = cookies.find(c => c.name === 'ds_user');

        if (sessionCookie && sessionCookie.value) {
            res.json({
                loggedIn: true,
                username: userCookie?.value || 'unknown',
                cookieCount: cookies.length
            });
        } else {
            res.json({ loggedIn: false, message: 'No valid session' });
        }
    } catch (error) {
        res.json({ loggedIn: false, error: error.message });
    }
});

/**
 * GET /health - Health check
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        platform: 'instagram',
        timestamp: new Date().toISOString(),
        browser: browserManager.getStats(),
        rateLimit: rateLimiter.getStats(),
        errors: errorRecovery.getStats()
    });
});

/**
 * GET /proxy - Proxy for CORS bypass
 */
/**
 * GET /proxy - Proxy for CORS bypass
 */
router.get('/proxy', async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL diperlukan' });
        }

        const fetch = (await import('node-fetch')).default;

        // Prepare headers
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.instagram.com/',
            'Origin': 'https://www.instagram.com',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        };

        // Try to add cookies if available
        try {
            if (fs.existsSync(COOKIES_PATH)) {
                const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf-8'));
                // Format cookies for header: "name=value; name2=value2"
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                headers['Cookie'] = cookieString;
            }
        } catch (e) {
            // Ignore cookie errors
        }

        let response = await fetch(url, { headers });

        if (!response.ok) {
            // Retry without specific headers if failed
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch media' });
        }

        const contentType = response.headers.get('content-type');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline'); // Changed to inline for preview
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

        response.body.pipe(res);

    } catch (error) {
        console.error('[Instagram] Proxy error:', error);
        res.status(500).json({ error: 'Proxy error' });
    }
});

/**
 * POST /save - Save media to disk
 */
router.post('/save', async (req, res) => {
    try {
        const { url, filename, type, username, downloadPath } = req.body;

        if (!url || !filename) {
            return res.status(400).json({
                success: false,
                error: 'URL dan filename diperlukan'
            });
        }

        const baseFolder = downloadPath && downloadPath.trim()
            ? downloadPath.trim()
            : DEFAULT_DOWNLOAD_FOLDER;

        const safeUsername = (username || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
        const userFolder = path.join(baseFolder, safeUsername);

        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }

        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.instagram.com/'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download');
        }

        const buffer = await response.arrayBuffer();
        const filePath = path.join(userFolder, filename);
        fs.writeFileSync(filePath, Buffer.from(buffer));

        console.log(`[Instagram] Saved: ${safeUsername}/${filename}`);

        res.json({
            success: true,
            filename,
            username: safeUsername,
            path: filePath,
            size: buffer.byteLength
        });

    } catch (error) {
        console.error('[Instagram] Save error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal menyimpan file: ' + error.message
        });
    }
});

/**
 * POST /batch-save - Batch download
 */
router.post('/batch-save', async (req, res) => {
    try {
        const { items, username, downloadPath } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Items array diperlukan'
            });
        }

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username diperlukan'
            });
        }

        const jobId = downloadQueue.addBatch(items, username, downloadPath);
        console.log(`[Instagram] Batch job started: ${jobId} (${items.length} items)`);

        res.json({
            success: true,
            jobId,
            total: items.length,
            message: 'Download started in background'
        });

    } catch (error) {
        console.error('[Instagram] Batch save error:', error);
        res.status(500).json({
            success: false,
            error: 'Batch save failed: ' + error.message
        });
    }
});

/**
 * GET /batch-status/:jobId - Check batch job status
 */
router.get('/batch-status/:jobId', (req, res) => {
    const status = downloadQueue.getStatus(req.params.jobId);
    res.json(status);
});

/**
 * GET /queue-stats - Get download queue stats
 */
router.get('/queue-stats', (req, res) => {
    res.json(downloadQueue.getStats());
});

module.exports = router;
