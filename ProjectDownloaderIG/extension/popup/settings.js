/**
 * InstaDown Settings Page
 * Realtime server status polling
 */

// Default settings
const DEFAULT_SETTINGS = {
    serverUrl: 'http://localhost:3000',
    downloadPath: ''
};

// DOM elements
let downloadPathInput, serverUrlInput;
let saveBtn, clearCacheBtn, resetBtn, backBtn;
let importCookiesBtn, loginStatus, statusIcon, statusText;
let serverStatus, checkStatusBtn;
let toast, toastMessage;

// Polling state
let statusPollingInterval = null;
let lastServerStatus = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Get elements
    downloadPathInput = document.getElementById('downloadPath');
    serverUrlInput = document.getElementById('serverUrl');
    saveBtn = document.getElementById('saveBtn');
    clearCacheBtn = document.getElementById('clearCacheBtn');
    resetBtn = document.getElementById('resetBtn');
    backBtn = document.getElementById('backBtn');
    importCookiesBtn = document.getElementById('importCookiesBtn');
    loginStatus = document.getElementById('loginStatus');
    statusIcon = document.getElementById('statusIcon');
    statusText = document.getElementById('statusText');
    serverStatus = document.getElementById('serverStatus');
    checkStatusBtn = document.getElementById('checkStatusBtn');
    toast = document.getElementById('toast');
    toastMessage = document.getElementById('toastMessage');

    // Add event listeners
    saveBtn?.addEventListener('click', saveSettings);
    clearCacheBtn?.addEventListener('click', clearCache);
    resetBtn?.addEventListener('click', resetSettings);
    backBtn?.addEventListener('click', goBack);
    importCookiesBtn?.addEventListener('click', importCookies);
    checkStatusBtn?.addEventListener('click', checkServerStatus);

    // Load current settings
    await loadSettings();

    // Check login status
    await checkLoginStatus();

    // Check server status and start polling
    await checkServerStatus();
    startStatusPolling();
}

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
        console.log('[Settings] Stopped status polling');
    }
}

/**
 * Check server status (with loading indicator)
 */
async function checkServerStatus() {
    if (!serverStatus) return;
    const indicator = serverStatus.querySelector('.status-indicator');
    const serverStatusText = serverStatus.querySelector('.server-status-text');

    if (indicator) indicator.className = 'status-indicator checking';
    if (serverStatusText) serverStatusText.textContent = 'Checking...';

    await performStatusCheck();
}

/**
 * Silent status check (for polling)
 */
async function checkServerStatusSilent() {
    await performStatusCheck();
}

/**
 * Perform the actual status check
 */
async function performStatusCheck() {
    if (!serverStatus) return;
    const indicator = serverStatus.querySelector('.status-indicator');
    const serverStatusText = serverStatus.querySelector('.server-status-text');
    const currentServerUrl = serverUrlInput?.value || DEFAULT_SETTINGS.serverUrl;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${currentServerUrl}/api/instagram/health`, {
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
            if (serverStatusText) serverStatusText.textContent = `Online - Browser: ${data.browser?.isRunning ? 'Running' : 'Idle'}`;
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
    if (!serverStatus) return;
    const indicator = serverStatus.querySelector('.status-indicator');

    if (indicator) {
        indicator.classList.add('status-changed');
        setTimeout(() => {
            indicator.classList.remove('status-changed');
        }, 1000);
    }

    console.log(`[Settings] Server status changed to: ${newStatus}`);
}

/**
 * Check Instagram login status
 */
async function checkLoginStatus() {
    try {
        updateLoginStatus('checking', '', 'Checking...');

        // Get Instagram cookies from browser
        const cookies = await getInstagramCookies();
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        const usernameCookie = cookies.find(c => c.name === 'ds_user');

        if (sessionCookie && sessionCookie.value) {
            const username = usernameCookie ? usernameCookie.value : 'user';
            updateLoginStatus('logged-in', '', `Logged in as @${username}`);
        } else {
            updateLoginStatus('logged-out', '', 'Not logged in');
        }
    } catch (error) {
        console.error('Error checking login status:', error);
        updateLoginStatus('logged-out', '', 'Cannot check status');
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
 * Get Instagram cookies from browser
 */
async function getInstagramCookies() {
    return new Promise((resolve, reject) => {
        // Check if cookies API is available
        if (!chrome.cookies || !chrome.cookies.getAll) {
            console.error('chrome.cookies API not available');
            reject(new Error('Cookies API not available. Please reload extension.'));
            return;
        }

        chrome.cookies.getAll({ domain: '.instagram.com' }, (cookies) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(cookies || []);
        });
    });
}

/**
 * Import cookies from browser and send to server
 */
async function importCookies() {
    try {
        importCookiesBtn.disabled = true;
        importCookiesBtn.textContent = 'Importing...';

        // Get Instagram cookies
        const cookies = await getInstagramCookies();

        if (!cookies || cookies.length === 0) {
            showToastMsg('No Instagram cookies found. Please login to Instagram first.');
            return;
        }

        // Check for sessionid
        const sessionCookie = cookies.find(c => c.name === 'sessionid');
        if (!sessionCookie || !sessionCookie.value) {
            showToastMsg('Session not found. Please login to Instagram.');
            return;
        }

        // Format cookies for Puppeteer
        const formattedCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            secure: c.secure || false,
            httpOnly: c.httpOnly || false,
            sameSite: c.sameSite || 'Lax'
        }));

        // Get server URL from settings
        const serverUrl = serverUrlInput?.value || 'http://localhost:3000';

        // Send to server
        const response = await fetch(`${serverUrl}/api/instagram/set-cookies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies: formattedCookies })
        });

        const result = await response.json();

        if (result.success) {
            showToastMsg('Cookies imported successfully!');
            await checkLoginStatus();
        } else {
            showToastMsg('Error: ' + (result.error || 'Failed to import cookies'));
        }

    } catch (error) {
        console.error('Import cookies error:', error);
        showToastMsg('Error: ' + error.message);
    } finally {
        importCookiesBtn.disabled = false;
        importCookiesBtn.textContent = 'Import Cookies dari Browser';
    }
}

/**
 * Load settings from storage
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        const settings = { ...DEFAULT_SETTINGS, ...result.settings };

        // Apply to UI
        if (serverUrlInput) serverUrlInput.value = settings.serverUrl;
        if (downloadPathInput) downloadPathInput.value = settings.downloadPath || '';

        console.log('Settings loaded:', settings);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
    try {
        const settings = {
            serverUrl: serverUrlInput?.value || 'http://localhost:3000',
            downloadPath: downloadPathInput?.value?.trim() || ''
        };

        await chrome.storage.sync.set({ settings });

        showToastMsg('Pengaturan tersimpan!');
        console.log('Settings saved:', settings);

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
 * Clear cache (stored state)
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
        await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
        await loadSettings();
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
 * Show toast message
 */
function showToastMsg(message) {
    if (toastMessage) toastMessage.textContent = message;
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }
}

/**
 * Go back to popup
 */
function goBack() {
    window.location.href = 'popup.html';
}

/**
 * Get settings (exported for use in popup.js)
 */
async function getSettings() {
    try {
        const result = await chrome.storage.sync.get('settings');
        return { ...DEFAULT_SETTINGS, ...result.settings };
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSettings, DEFAULT_SETTINGS };
}
