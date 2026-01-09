/**
 * Unified Express Server for Instagram & TikTok Downloader
 * Combines both platforms on a single port with namespaced routes
 * 
 * Routes:
 *   /api/instagram/*  - Instagram endpoints
 *   /api/tiktok/*     - TikTok endpoints
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// Mount platform-specific routers
const instagramRouter = require('./routes/instagram');
const tiktokRouter = require('./routes/tiktok');

app.use('/api/instagram', instagramRouter);
app.use('/api/tiktok', tiktokRouter);

// Root status page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Combined health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'unified-media-downloader',
        timestamp: new Date().toISOString(),
        platforms: {
            instagram: '/api/instagram',
            tiktok: '/api/tiktok'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint tidak ditemukan',
        availableRoutes: [
            '/api/instagram/*',
            '/api/tiktok/*'
        ]
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         Unified Media Downloader Server Started!              ║
╠═══════════════════════════════════════════════════════════════╣
║  🌐 Server URL:  http://localhost:${PORT}                        ║
╠───────────────────────────────────────────────────────────────╣
║  📸 Instagram:   http://localhost:${PORT}/api/instagram           ║
║  🎵 TikTok:      http://localhost:${PORT}/api/tiktok              ║
╠───────────────────────────────────────────────────────────────╣
║  Endpoints:                                                   ║
║    POST /api/instagram/download  - Download IG media          ║
║    POST /api/tiktok/download     - Download TT media          ║
╚═══════════════════════════════════════════════════════════════╝
`);
});

module.exports = app;
