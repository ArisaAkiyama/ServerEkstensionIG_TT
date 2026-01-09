/**
 * TikDown Settings Script
 * Cookie status auto-sync from TikTok visits
 * Realtime server status polling
 */

// Default settings
const defaultSettings = {
    serverUrl: 'http://localhost:3000',
    downloadPath: ''
};

// Current settings
let settings = { ...defaultSettings };

// DOM Elements (initialized after DOMContentLoaded)
let backBtn, downloadPathInput, serverStatus, checkStatusBtn;
let saveBtn, clearCacheBtn, resetBtn;
let loginStatus, statusIcon, statusText;
let toast, toastMessage;

// Polling interval reference
let statusPollingInterval = null;
let lastServerStatus = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Get DOM elements
    backBtn = document.getElementById('backBtn');
    downloadPathInput = document.getElementById('downloadPath');
    serverStatus = document.getElementById('serverStatus');
    checkStatusBtn = document.getElementById('checkStatusBtn');
    saveBtn = document.getElementById('saveBtn');
    clearCacheBtn = document.getElementById('clearCacheBtn');
    resetBtn = document.getElementById('resetBtn');
    loginStatus = document.getElementById('loginStatus');
    statusIcon = document.getElementById('statusIcon');
    statusText = document.getElementById('statusText');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toastMessage');

    // Setup event listeners
    backBtn?.addEventListener('click', goBack);
    checkStatusBtn?.addEventListener('click', () => {
        checkServerStatus();
        checkLoginStatus();
    });
    saveBtn?.addEventListener('click', handleSave);
    clearCacheBtn?.addEventListener('click', clearCache);
    resetBtn?.addEventListener('click', resetSettings);

    // Load settings and check status
    await loadSettings();
    updateUI();
    checkServerStatus();
    checkLoginStatus();

    // Start realtime polling every 5 seconds
    startStatusPolling();
});

// Stop polling when leaving page
window.addEventListener('beforeunload', () => {
    stopStatusPolling();
});

/**
 * Start polling server status every 5 seconds
 */
function startStatusPolling() {
    stopStatusPolling();
    statusPollingInterval = setInterval(() => {
        checkServerStatusSilent();
    }, 5000);
    console.log('[Settings] Started realtime status polling (5s interval)');
}

/**
 * Stop polling
 */
function stopStatusPolling() {
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        if (result.settings) {
            settings = { ...defaultSettings, ...result.settings };
        }
    } catch (e) {
        console.log('Using default settings:', e);
    }
}

/**
 * Update UI with current settings
 */
function updateUI() {
    if (downloadPathInput) downloadPathInput.value = settings.downloadPath || '';
}

/**
 * Handle save button
 */
async function handleSave() {
    try {
        settings.downloadPath = downloadPathInput?.value?.trim() || '';
        await chrome.storage.sync.set({ settings });
        showToastMsg('Pengaturan tersimpan!');

        // Redirect to popup after short delay
        setTimeout(() => {
            window.location.href = 'popup.html';
        }, 800);
    } catch (error) {
        console.error('Error saving settings:', error);
        showToastMsg('Gagal menyimpan pengaturan');
    }
}

/**
 * Clear cache
 */
async function clearCache() {
    try {
        await chrome.storage.local.clear();
        await chrome.action.setBadgeText({ text: '' });
        showToastMsg('Cache dihapus!');
    } catch (error) {
        console.error('Error clearing cache:', error);
        showToastMsg('Gagal menghapus cache');
    }
}

/**
 * Reset settings to default
 */
async function resetSettings() {
    if (!confirm('Reset semua pengaturan ke default?')) return;

    try {
        settings = { ...defaultSettings };
        await chrome.storage.sync.set({ settings });
        updateUI();
        showToastMsg('Pengaturan direset!');
    } catch (error) {
        console.error('Error resetting settings:', error);
        showToastMsg('Gagal reset pengaturan');
    }
}

/**
 * Go back to popup
 */
function goBack() {
    window.location.href = 'popup.html';
}

/**
 * Check server status (with loading indicator)
 */
async function checkServerStatus() {
    const indicator = serverStatus?.querySelector('.status-indicator');
    const serverStatusText = serverStatus?.querySelector('.server-status-text');

    if (indicator) indicator.className = 'status-indicator checking';
    if (serverStatusText) serverStatusText.textContent = 'Checking...';

    await performStatusCheck();
}

/**
 * Silent status check (for polling - no loading indicator)
 */
async function checkServerStatusSilent() {
    await performStatusCheck();
}

/**
 * Perform the actual status check
 */
async function performStatusCheck() {
    const indicator = serverStatus?.querySelector('.status-indicator');
    const serverStatusText = serverStatus?.querySelector('.server-status-text');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${settings.serverUrl}/api/tiktok/health`, {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const newStatus = 'online';

            if (lastServerStatus !== null && lastServerStatus !== newStatus) {
                showStatusChangeNotification('online');
            }
            lastServerStatus = newStatus;

            if (indicator) indicator.className = 'status-indicator online';
            if (serverStatusText) {
                serverStatusText.textContent = `Online - Browser: ${data.browser?.isRunning ? 'Running' : 'Idle'}`;
            }
        } else {
            throw new Error('Server error');
        }
    } catch (e) {
        const newStatus = 'offline';

        if (lastServerStatus !== null && lastServerStatus !== newStatus) {
            showStatusChangeNotification('offline');
        }
        lastServerStatus = newStatus;

        if (indicator) indicator.className = 'status-indicator offline';
        if (serverStatusText) serverStatusText.textContent = 'Offline - Server tidak terkoneksi';
    }
}

/**
 * Show notification when server status changes
 */
function showStatusChangeNotification(newStatus) {
    const indicator = serverStatus?.querySelector('.status-indicator');

    if (indicator) {
        indicator.classList.add('status-changed');
        setTimeout(() => {
            indicator.classList.remove('status-changed');
        }, 1000);
    }

    console.log(`[Settings] Server status changed to: ${newStatus}`);
}

/**
 * Check TikTok cookie status from server
 */
async function checkLoginStatus() {
    try {
        updateLoginStatus('checking', '', 'Checking...');

        const response = await fetch(`${settings.serverUrl}/api/tiktok/cookie-status`);
        const data = await response.json();

        if (data.loggedIn) {
            updateLoginStatus('logged-in', '', `TikTok cookies tersedia (${data.cookieCount} cookies)`);
        } else {
            updateLoginStatus('logged-out', '', 'TikTok cookies tidak tersedia');
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        updateLoginStatus('logged-out', '', 'Tidak dapat cek status cookies');
    }
}

/**
 * Update login status UI
 */
function updateLoginStatus(state, icon, text) {
    if (loginStatus) {
        loginStatus.className = 'login-status ' + state;
    }
    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
}

/**
 * Show toast message
 */
function showToastMsg(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}
