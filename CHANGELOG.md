# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-10

### Added
- Initial release of Media Downloader Server
- Unified server combining Instagram and TikTok downloaders
- Modern GUI launcher with frameless window design
- Custom window controls (minimize, close to tray)
- Animated server status indicator (online/offline/loading)
- Premium white theme with Inter font
- System tray integration with dynamic icon color
- Auto-restart feature for server crash recovery
- Inno Setup installer with bundled Node.js
- Browser extensions for both Instagram and TikTok

### Technical Details
- Python-based GUI using pywebview
- Node.js/Express backend server
- Puppeteer-based scrapers for media extraction
- CORS proxy endpoints for media streaming
- Batch download queue system
- Rate limiting and error recovery

### Installation Options
- Standalone installer (no Node.js required)
- Run from source (Python + Node.js)
- Portable executable

### API Routes
- `/api/instagram/*` - Instagram media endpoints
- `/api/tiktok/*` - TikTok media endpoints
- `/api/health` - Server health check

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | 2026-01-10 | Initial release |
