# Media Downloader Server

Unified server for Instagram and TikTok media downloading with a modern GUI launcher.

## Features

- Unified Server: Single server handling both Instagram and TikTok downloads
- Modern GUI Launcher: Frameless window with premium white theme
- System Tray Integration: Minimize to tray with status indicator
- Auto-Restart: Automatic server recovery on crash
- Bundled Node.js: Standalone installer, no separate Node.js installation required

## Quick Start Guide

### Step 1: Install the Server

1. Download `MediaDownloaderSetup.exe` from the [Releases](https://github.com/ArisaAkiyama/ServerEkstensionIG_TT/releases) page
2. Run the installer and follow the prompts
3. The application will be installed to `C:\Program Files\Media Downloader Server\`
4. A desktop shortcut will be created automatically

### Step 2: Run the Server

1. Double-click `Media Downloader Server` from the desktop or Start Menu
2. Click the **Start** button to start the server
3. Wait until the status shows **Online** (green indicator)
4. The server is now running at `http://localhost:3000`

### Step 3: Install Browser Extensions

#### Instagram Extension

1. Open Chrome/Edge browser
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to the installation folder:
   - `C:\Program Files\Media Downloader Server\ProjectDownloaderIG\extension`
6. Click **Select Folder**
7. The Instagram Downloader extension icon will appear in your toolbar

#### TikTok Extension

1. Open Chrome/Edge browser
2. Go to `chrome://extensions/` (or `edge://extensions/`)
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Navigate to the installation folder:
   - `C:\Program Files\Media Downloader Server\ProjectDownloaderTT\extension`
6. Click **Select Folder**
7. The TikTok Downloader extension icon will appear in your toolbar

### Step 4: Using the Extensions

1. Make sure the server is running (status shows **Online**)
2. Go to Instagram or TikTok in your browser
3. Navigate to a post/video you want to download
4. Click the extension icon in your toolbar
5. Click **Download** to save the media

---

## For Developers

### Requirements

- Python 3.8+
- Node.js 18+
- npm

### Run from Source

```bash
# Clone repository
git clone https://github.com/ArisaAkiyama/ServerEkstensionIG_TT.git
cd ServerEkstensionIG_TT

# Install dependencies
npm install
cd ProjectDownloaderIG && npm install && cd ..
cd ProjectDownloaderTT && npm install && cd ..

# Install Python dependencies
pip install pywebview pystray pillow

# Run the launcher
python server_launcher.py
```

### Build Installer

1. Install [Inno Setup](https://jrsoftware.org/isdl.php)
2. Run `build-installer.bat`
3. Find the installer at `installer_output/MediaDownloaderSetup.exe`

### Build Executable Only

```bash
# Run build script
build-exe.bat

# The executable will be created at dist/MediaDownloaderServer.exe
```

---

## Project Structure

```
ServerEkstensionIG_TT/
├── server.js                 # Main Express server
├── server_launcher.py        # Python GUI launcher
├── routes/
│   ├── instagram.js          # Instagram API routes
│   └── tiktok.js             # TikTok API routes
├── ProjectDownloaderIG/      # Instagram scraper and extension
│   └── extension/            # Instagram browser extension
├── ProjectDownloaderTT/      # TikTok scraper and extension
│   └── extension/            # TikTok browser extension
├── nodejs/                   # Bundled Node.js (for installer)
├── icon/                     # Application icons
└── public/                   # Static web files
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/instagram/download` | Download Instagram media |
| POST | `/api/tiktok/download` | Download TikTok media |
| GET | `/api/health` | Server health check |

## Configuration

Create a `.env` file in the root directory:

```env
PORT=3000
DOWNLOAD_PATH=C:/Users/YourName/Downloads
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server stuck on "Starting..." | Check if port 3000 is in use by another application |
| Extension cannot connect | Make sure the server status shows "Online" |
| Download fails | Check if you are logged in to Instagram/TikTok |

## License

MIT License

## Author

ArisaAkiyama
