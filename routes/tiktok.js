/**
 * TikTok Router for Unified Server
 * Wraps the existing TikTok scraper and handlers
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Import from ProjectDownloaderTT
const TT_PATH = path.join(__dirname, '..', 'ProjectDownloaderTT');
const { scrapeTikTokVideo, isValidTikTokUrl, saveCapturedBuffer, getCapturedBuffer } = require(path.join(TT_PATH, 'scraper'));
const browserManager = require(path.join(TT_PATH, 'browser-manager'));
const rateLimiter = require(path.join(TT_PATH, 'rate-limiter'));
const errorRecovery = require(path.join(TT_PATH, 'error-recovery'));
const downloadQueue = require(path.join(TT_PATH, 'download-queue'));

const COOKIES_PATH = path.join(TT_PATH, 'cookies.json');
const DEFAULT_DOWNLOAD_FOLDER = process.env.DOWNLOAD_PATH || path.join(require('os').homedir(), 'Downloads', 'TikTok');

/**
 * POST /download - Download TikTok media
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

        if (!isValidTikTokUrl(url)) {
            return res.status(400).json({
                success: false,
                error: 'URL tidak valid. Masukkan URL video TikTok yang benar.',
                code: 'INVALID_URL'
            });
        }

        console.log('[TikTok] Processing:', url);
        const result = await scrapeTikTokVideo(url);

        if (result.success) {
            console.log(`[TikTok] Extracted ${result.count} media items`);
            return res.json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error('[TikTok] Server error:', error);
        return res.status(500).json({
            success: false,
            error: 'Terjadi kesalahan server. Silakan coba lagi.',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /set-cookies - Save TikTok cookies
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

        const sessionCookie = cookies.find(c =>
            c.name === 'sessionid' || c.name === 'sid_tt' || c.name === 'tt_chain_token'
        );
        if (!sessionCookie || !sessionCookie.value) {
            return res.status(400).json({
                success: false,
                error: 'Session cookie tidak ditemukan (sessionid/sid_tt/tt_chain_token)'
            });
        }

        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log(`[TikTok] Auto-synced from browser: ${cookies.length} cookies`);

        res.json({
            success: true,
            message: 'Cookies saved successfully',
            count: cookies.length
        });

    } catch (error) {
        console.error('[TikTok] Set cookies error:', error);
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
        const sessionCookie = cookies.find(c =>
            c.name === 'sessionid' || c.name === 'sid_tt'
        );

        if (sessionCookie && sessionCookie.value && !sessionCookie.value.includes('YOUR_')) {
            res.json({
                loggedIn: true,
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
        platform: 'tiktok',
        timestamp: new Date().toISOString(),
        browser: browserManager.getStats(),
        rateLimit: rateLimiter.getStats(),
        errors: errorRecovery.getStats()
    });
});

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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity;q=1, *;q=0',
            'Range': 'bytes=0-',
            'Referer': 'https://www.tiktok.com/',
            'Origin': 'https://www.tiktok.com',
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site'
        };

        let response = await fetch(url, { headers, redirect: 'follow' });

        if (response.status === 403) {
            delete headers['Range'];
            response = await fetch(url, { headers, redirect: 'follow' });
        }

        if (response.status === 403) {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
                },
                redirect: 'follow'
            });
        }

        if (!response.ok && response.status !== 206) {
            return res.status(response.status).json({ error: 'Failed to fetch media' });
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'attachment');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        response.body.pipe(res);

    } catch (error) {
        console.error('[TikTok] Proxy error:', error);
        res.status(500).json({ error: 'Proxy error: ' + error.message });
    }
});

/**
 * POST /save-captured - Save captured buffer
 */
router.post('/save-captured', (req, res) => {
    try {
        const { filename, username } = req.body;

        if (!filename || !username) {
            return res.status(400).json({
                success: false,
                error: 'Filename dan username diperlukan'
            });
        }

        const result = saveCapturedBuffer(filename, username);

        if (result.success) {
            res.json({
                success: true,
                path: result.path,
                size: result.size,
                message: `File tersimpan: ${filename}`
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || 'Gagal menyimpan file'
            });
        }
    } catch (error) {
        console.error('[TikTok] Save captured error:', error);
        res.status(500).json({
            success: false,
            error: 'Gagal menyimpan: ' + error.message
        });
    }
});

/**
 * GET /download-captured/:filename - Get captured buffer as download
 */
router.get('/download-captured/:filename', (req, res) => {
    const filename = req.params.filename;
    const buffer = getCapturedBuffer(filename);

    if (!buffer) {
        return res.status(404).json({ error: 'File not found or expired' });
    }

    const ext = filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4';
    res.setHeader('Content-Type', ext);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
});

/**
 * POST /save - Save media to disk
 */
router.post('/save', async (req, res) => {
    console.log('[TikTok] Save request:', req.body.filename || 'no filename');
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

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tiktok.com/',
            'Origin': 'https://www.tiktok.com'
        };

        let response = await fetch(url, { headers, redirect: 'follow' });

        if (response.status === 403) {
            response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
                },
                redirect: 'follow'
            });
        }

        if (!response.ok && response.status !== 206) {
            throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const filePath = path.join(userFolder, filename);
        fs.writeFileSync(filePath, Buffer.from(buffer));

        console.log(`[TikTok] Saved: ${safeUsername}/${filename}`);

        res.json({
            success: true,
            filename,
            username: safeUsername,
            path: filePath,
            size: buffer.byteLength
        });

    } catch (error) {
        console.error('[TikTok] Save error:', error);
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
        console.log(`[TikTok] Batch job started: ${jobId} (${items.length} items)`);

        res.json({
            success: true,
            jobId,
            total: items.length,
            message: 'Download started in background'
        });

    } catch (error) {
        console.error('[TikTok] Batch save error:', error);
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
