"""
Media Downloader Server Launcher
Uses pywebview for native window with HTML/CSS interface
Premium GUI with frameless window design
"""

import webview
import subprocess
import os
import sys
import socket
import threading
import time
import base64

# Lazy imports for faster startup
Image = None
ImageDraw = None
pystray = None
item = None

# Get base directory
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load logo as base64 for embedding in HTML
def get_logo_base64():
    logo_path = os.path.join(BASE_DIR, 'icon', 'cloud.png')
    if os.path.exists(logo_path):
        with open(logo_path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return None

LOGO_BASE64 = get_logo_base64()

# HTML Template with Premium Light Theme
HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Media Downloader Server</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #ffffff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            -webkit-user-select: none;
            user-select: none;
            overflow: hidden;
        }
        
        /* Custom Title Bar */
        .title-bar {
            height: 40px;
            background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding: 0 8px;
            -webkit-app-region: drag;
        }
        
        .window-controls {
            display: flex;
            gap: 8px;
            -webkit-app-region: no-drag;
        }
        
        .window-btn {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            background: transparent;
        }
        
        .window-btn:hover {
            background: #e2e8f0;
        }
        
        .window-btn.minimize:hover {
            background: #fef3c7;
        }
        
        .window-btn.close:hover {
            background: #fee2e2;
        }
        
        .window-btn svg {
            width: 16px;
            height: 16px;
            stroke: #64748b;
            stroke-width: 2;
            fill: none;
        }
        
        .window-btn.close:hover svg {
            stroke: #dc2626;
        }
        
        /* Main Content */
        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            gap: 16px;
        }
        
        /* Logo & Branding */
        .branding {
            text-align: center;
        }
        
        .logo {
            width: 72px;
            height: 72px;
            margin-bottom: 12px;
            filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3));
        }
        
        .app-title {
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 4px;
        }
        
        .app-subtitle {
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
        }
        
        /* Status Card */
        .status-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 20px 32px;
            text-align: center;
            min-width: 280px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 8px;
        }
        
        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ef4444;
            transition: all 0.3s ease;
        }
        
        .status-dot.online {
            background: #10b981;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2);
            animation: pulse-green 2s infinite;
        }
        
        .status-dot.offline {
            background: #ef4444;
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
        }
        
        .status-dot.loading {
            background: #f59e0b;
            box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2);
            animation: pulse-yellow 1s infinite;
        }
        
        @keyframes pulse-green {
            0%, 100% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2); }
            50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.1); }
        }
        
        @keyframes pulse-yellow {
            0%, 100% { box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.2); }
            50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.1); }
        }
        
        .status-text {
            font-size: 18px;
            font-weight: 600;
            color: #1e293b;
        }
        
        .status-text.online {
            color: #059669;
        }
        
        .status-text.offline {
            color: #dc2626;
        }
        
        .status-text.loading {
            color: #d97706;
        }
        
        .server-url {
            font-size: 13px;
            color: #3b82f6;
            font-weight: 500;
            cursor: pointer;
            transition: color 0.2s;
        }
        
        .server-url:hover {
            color: #2563eb;
            text-decoration: underline;
        }
        
        /* Buttons */
        .button-group {
            display: flex;
            gap: 12px;
            width: 100%;
            max-width: 320px;
        }
        
        .btn {
            flex: 1;
            padding: 14px 24px;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        
        .btn-start {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
        }
        
        .btn-start:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45);
        }
        
        .btn-start:active:not(:disabled) {
            transform: translateY(0);
        }
        
        .btn-stop {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: white;
            box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
        }
        
        .btn-stop:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(239, 68, 68, 0.45);
        }
        
        .btn-stop:active:not(:disabled) {
            transform: translateY(0);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
            box-shadow: none !important;
        }
        
        .btn svg {
            width: 16px;
            height: 16px;
            fill: currentColor;
        }
        
        /* Toggle */
        .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 320px;
            padding: 12px 16px;
            background: #f8fafc;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
        }
        
        .toggle-label {
            font-size: 13px;
            color: #475569;
            font-weight: 500;
        }
        
        .toggle-switch {
            position: relative;
            width: 44px;
            height: 24px;
        }
        
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #cbd5e1;
            transition: 0.3s;
            border-radius: 24px;
        }
        
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        input:checked + .toggle-slider {
            background-color: #10b981;
        }
        
        input:checked + .toggle-slider:before {
            transform: translateX(20px);
        }
        
        /* Footer */
        .footer {
            height: 36px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
        }
        
        .version {
            font-size: 11px;
            color: #94a3b8;
            font-weight: 500;
        }
        
        .log-msg {
            font-size: 11px;
            color: #64748b;
            font-weight: 500;
        }
        
        /* Toast */
        .toast {
            position: fixed;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 500;
            opacity: 0;
            transition: all 0.3s ease;
            z-index: 1000;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        
        .toast.show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        
        .toast.error {
            background: #dc2626;
            color: white;
        }
        
        .toast.success {
            background: #059669;
            color: white;
        }
    </style>
</head>
<body>
    <!-- Custom Title Bar -->
    <div class="title-bar">
        <div class="window-controls">
            <button class="window-btn minimize" onclick="pywebview.api.minimize_window()" title="Minimize">
                <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="window-btn close" onclick="pywebview.api.close_to_tray()" title="Close to Tray">
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    </div>
    
    <!-- Main Content -->
    <div class="main-content">
        <!-- Branding -->
        <div class="branding">
            <img src="data:image/png;base64,""" + (LOGO_BASE64 or "") + """" class="logo" alt="Logo" onerror="this.style.display='none'">
            <h1 class="app-title">Media Downloader</h1>
            <p class="app-subtitle">Instagram & TikTok Server</p>
        </div>
        
        <!-- Status Card -->
        <div class="status-card">
            <div class="status-indicator">
                <div id="statusDot" class="status-dot offline"></div>
                <span id="statusText" class="status-text offline">Offline</span>
            </div>
            <a id="serverLink" class="server-url" onclick="pywebview.api.open_browser()">
                http://localhost:3000
            </a>
        </div>
        
        <!-- Buttons -->
        <div class="button-group">
            <button id="btnStart" class="btn btn-start" onclick="startServer()">
                <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
                Start
            </button>
            <button id="btnStop" class="btn btn-stop" onclick="stopServer()" disabled>
                <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                Stop
            </button>
        </div>
        
        <!-- Auto-restart Toggle -->
        <div class="toggle-row">
            <span class="toggle-label">Auto-restart jika crash</span>
            <label class="toggle-switch">
                <input type="checkbox" id="autoRestartToggle" checked onchange="toggleAutoRestart(this.checked)">
                <span class="toggle-slider"></span>
            </label>
        </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
        <span class="version">v1.0.0</span>
        <span id="logMsg" class="log-msg">Ready to start</span>
    </div>
    
    <!-- Toast -->
    <div id="toast" class="toast"></div>

    <script>
        let isOnline = false;
        let isStarting = false;
        let isStopping = false;

        function updateUI(online) {
            isOnline = online;
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            const btnStart = document.getElementById('btnStart');
            const btnStop = document.getElementById('btnStop');
            const logMsg = document.getElementById('logMsg');

            if (online && !isStopping) {
                isStarting = false;
                dot.className = 'status-dot online';
                text.textContent = 'Online';
                text.className = 'status-text online';
                btnStart.disabled = true;
                btnStop.disabled = false;
                logMsg.textContent = 'Server running on port 3000';
            } else if (!online && !isStarting) {
                isStopping = false;
                dot.className = 'status-dot offline';
                text.textContent = 'Offline';
                text.className = 'status-text offline';
                btnStart.disabled = false;
                btnStop.disabled = true;
                logMsg.textContent = 'Server stopped';
            }
        }

        async function startServer() {
            if (isStarting) return;
            
            isStarting = true;
            const btnStart = document.getElementById('btnStart');
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            
            dot.className = 'status-dot loading';
            text.textContent = 'Starting...';
            text.className = 'status-text loading';
            btnStart.disabled = true;
            document.getElementById('logMsg').textContent = 'Starting server...';
            
            const result = await pywebview.api.start_server();
            
            if (result && result.success === false) {
                isStarting = false;
                await pywebview.api.set_server_should_run(false);
                showToast(result.error, 'error');
                dot.className = 'status-dot offline';
                text.textContent = 'Offline';
                text.className = 'status-text offline';
                btnStart.disabled = false;
                document.getElementById('logMsg').textContent = 'Error - Click to retry';
            } else {
                await pywebview.api.set_server_should_run(true);
            }
        }

        async function stopServer() {
            if (isStopping) return;
            
            isStopping = true;
            const btnStop = document.getElementById('btnStop');
            const dot = document.getElementById('statusDot');
            const text = document.getElementById('statusText');
            
            dot.className = 'status-dot loading';
            text.textContent = 'Stopping...';
            text.className = 'status-text loading';
            btnStop.disabled = true;
            document.getElementById('logMsg').textContent = 'Stopping server...';
            
            const result = await pywebview.api.stop_server();
            await pywebview.api.set_server_should_run(false);
            
            if (result && result.success === false) {
                showToast(result.error, 'error');
            }
        }

        async function toggleAutoRestart(enabled) {
            await pywebview.api.toggle_auto_restart(enabled);
            showToast(enabled ? 'Auto-restart diaktifkan' : 'Auto-restart dinonaktifkan', enabled ? 'success' : 'error');
        }

        function showToast(message, type = 'error') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast ' + type + ' show';
            setTimeout(() => toast.classList.remove('show'), 4000);
        }

        async function checkStatus() {
            try {
                const online = await pywebview.api.check_status();
                updateUI(online);
            } catch (e) {
                updateUI(false);
            }
            setTimeout(checkStatus, 2000);
        }

        window.addEventListener('pywebviewready', checkStatus);
    </script>
</body>
</html>
"""

class Api:
    def check_status(self):
        """Check if server is running on port 3000"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', 3000))
            sock.close()
            return result == 0
        except:
            return False

    def start_server(self):
        """Start the Node.js server using bundled or system Node.js"""
        try:
            # Check for bundled Node.js first
            bundled_node = os.path.join(BASE_DIR, 'nodejs', 'node.exe')
            if os.path.exists(bundled_node):
                node_cmd = f'"{bundled_node}"'
            else:
                # Fallback to system Node.js
                node_check = subprocess.run(
                    'node --version',
                    shell=True,
                    capture_output=True,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
                )
                if node_check.returncode != 0:
                    return {'success': False, 'error': 'Node.js tidak ditemukan! Pastikan nodejs folder ada atau install Node.js.'}
                node_cmd = 'node'
            
            server_file = os.path.join(BASE_DIR, 'server.js')
            if not os.path.exists(server_file):
                return {'success': False, 'error': 'File server.js tidak ditemukan! Pastikan file berada di folder yang sama.'}
            
            node_modules = os.path.join(BASE_DIR, 'node_modules')
            if not os.path.exists(node_modules):
                return {'success': False, 'error': 'Folder node_modules tidak ditemukan! Jalankan npm install terlebih dahulu.'}
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            port_check = sock.connect_ex(('127.0.0.1', 3000))
            sock.close()
            if port_check == 0:
                return {'success': False, 'error': 'Port 3000 sudah digunakan!'}
            
            # Prepare command as list for shell=False (better for paths with spaces)
            if os.path.exists(bundled_node):
                cmd_args = [bundled_node, 'server.js']
            else:
                cmd_args = ['node', 'server.js']
            
            subprocess.Popen(
                cmd_args,
                shell=False,
                cwd=BASE_DIR,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            )
            return {'success': True, 'message': 'Server berhasil dijalankan!'}
            
        except Exception as e:
            return {'success': False, 'error': f'Terjadi kesalahan: {str(e)}'}

    def stop_server(self):
        """Stop the Node.js server"""
        try:
            result = subprocess.run(
                'taskkill /F /IM node.exe',
                shell=True,
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
            )
            if result.returncode == 0:
                return {'success': True, 'message': 'Server berhasil dihentikan!'}
            else:
                return {'success': False, 'error': 'Tidak ada proses server yang berjalan.'}
        except Exception as e:
            return {'success': False, 'error': f'Gagal menghentikan server: {str(e)}'}

    def open_browser(self):
        """Open browser to localhost"""
        try:
            import webbrowser
            webbrowser.open('http://localhost:3000')
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': f'Gagal membuka browser: {str(e)}'}

    def toggle_auto_restart(self, enabled):
        """Toggle auto-restart feature"""
        global auto_restart_enabled
        auto_restart_enabled = enabled
        return {'success': True, 'enabled': enabled}

    def get_auto_restart_status(self):
        """Get current auto-restart status"""
        global auto_restart_enabled
        return auto_restart_enabled

    def set_server_should_run(self, should_run):
        """Set flag indicating if server should be running"""
        global server_should_run
        server_should_run = should_run
        return True

    def minimize_window(self):
        """Minimize the window"""
        global window
        if window:
            window.minimize()

    def close_to_tray(self):
        """Close window to system tray"""
        global window
        if window:
            window.hide()

# Global references
window = None
tray_icon = None
auto_restart_enabled = True
server_should_run = False
restart_count = 0
max_restart_attempts = 5
current_server_status = False

def create_tray_image(online=False):
    """Create a simple colored icon for system tray based on server status"""
    width = 64
    height = 64
    image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    draw.ellipse([4, 4, 60, 60], fill='#3b82f6')
    
    if online:
        draw.ellipse([16, 16, 48, 48], fill='#10b981')
    else:
        draw.ellipse([16, 16, 48, 48], fill='#ef4444')
    
    return image

def update_tray_icon(online):
    """Update tray icon based on server status"""
    global tray_icon, current_server_status
    
    if current_server_status == online:
        return
    
    current_server_status = online
    
    if tray_icon and Image:
        try:
            tray_icon.icon = create_tray_image(online)
        except Exception as e:
            print(f"Error updating tray icon: {e}")

def on_show(icon, item):
    """Show the window"""
    global window
    if window:
        window.show()
        window.restore()

def on_hide(icon, item):
    """Hide the window"""
    global window
    if window:
        window.hide()

def on_exit(icon, item):
    """Exit the application and stop server"""
    global window, tray_icon
    
    subprocess.run(
        'taskkill /F /IM node.exe',
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    )
    
    if tray_icon:
        tray_icon.stop()
    if window:
        window.destroy()

def setup_tray():
    """Setup system tray icon"""
    global tray_icon
    
    menu = pystray.Menu(
        item('Show', on_show, default=True),
        item('Hide', on_hide),
        pystray.Menu.SEPARATOR,
        item('Exit', on_exit)
    )
    
    tray_icon = pystray.Icon(
        "MediaDownloader",
        create_tray_image(),
        "Media Downloader Server",
        menu
    )
    
    tray_icon.run()

def on_closing():
    """Handle window close - minimize to tray instead of exit"""
    global window
    if window:
        window.hide()
    return False

def monitor_server():
    """Background thread to monitor server and auto-restart if crashed"""
    global server_should_run, auto_restart_enabled, restart_count
    
    while True:
        time.sleep(3)
        
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', 3000))
            sock.close()
            is_running = (result == 0)
        except:
            is_running = False
        
        update_tray_icon(is_running)
        
        if not server_should_run:
            restart_count = 0
            continue
            
        if not auto_restart_enabled:
            continue
        
        if not is_running and server_should_run:
            if restart_count < max_restart_attempts:
                restart_count += 1
                print(f"[Auto-Restart] Server crashed! Restarting... (attempt {restart_count}/{max_restart_attempts})")
                
                # Use bundled or system Node.js
                bundled_node = os.path.join(BASE_DIR, 'nodejs', 'node.exe')
                if os.path.exists(bundled_node):
                    cmd_args = [bundled_node, 'server.js']
                else:
                    cmd_args = ['node', 'server.js']
                
                subprocess.Popen(
                    cmd_args,
                    shell=False,
                    cwd=BASE_DIR,
                    creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
                )
                time.sleep(3)
            else:
                print(f"[Auto-Restart] Max restart attempts reached ({max_restart_attempts}). Giving up.")
                server_should_run = False
        elif is_running:
            restart_count = 0

def main():
    global window
    api = Api()
    
    window = webview.create_window(
        'Media Downloader Server',
        html=HTML,
        js_api=api,
        width=480,
        height=520,
        resizable=False,
        frameless=True,
        easy_drag=True,
        background_color='#ffffff',
        on_top=False
    )
    
    window.events.closing += on_closing
    
    def start_background_services():
        global Image, ImageDraw, pystray, item
        
        from PIL import Image as PILImage, ImageDraw as PILDraw
        import pystray as systray
        from pystray import MenuItem
        
        Image = PILImage
        ImageDraw = PILDraw
        pystray = systray
        item = MenuItem
        
        setup_tray()
    
    tray_thread = threading.Thread(target=start_background_services, daemon=True)
    tray_thread.start()
    
    monitor_thread = threading.Thread(target=monitor_server, daemon=True)
    monitor_thread.start()
    
    webview.start()

if __name__ == '__main__':
    main()
