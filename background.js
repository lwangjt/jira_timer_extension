let focusActive = false;
let blockedSites = ["youtube.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com"];
let allowedSites = [
  "stackoverflow.com", 
  "stackexchange.com",
  "docs.microsoft.com",
  "developer.mozilla.org",
  "github.com",
  "gitlab.com",
  "vscode.dev",
  "code.visualstudio.com",
  "teams.microsoft.com",
  "outlook.com",
  "outlook.office.com",
  "office.com",
  "microsoft.com/en-us/microsoft-teams",
  "docs.python.org",
  "nodejs.org",
  "reactjs.org",
  "vuejs.org",
  "angular.io",
  "developer.chrome.com",
  "web.dev",
  "mdn.io"
];
let focusEndTime = null;
let currentTask = null;
let onBreak = false; // Track if user is on a temporary break

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.command === "START_FOCUS") {
    focusActive = true;
    focusEndTime = Date.now() + msg.duration * 60 * 1000;
    currentTask = {
      key: msg.taskKey,
      summary: msg.taskSummary,
      duration: msg.duration,
      startTime: Date.now()
    };
    
    // Store state in chrome.storage for popup sync
    chrome.storage.local.set({
      focusActive: true,
      focusEndTime: focusEndTime,
      focusTask: msg.taskKey,
      taskData: currentTask
    });
    
    chrome.alarms.create("endFocus", { when: focusEndTime });
    sendResponse({ 
      status: `Focus started for ${msg.duration} min on ${msg.taskKey}` 
    });
  }
  
  if (msg.command === "STOP_FOCUS") {
    focusActive = false;
    focusEndTime = null;
    
    // Clear state in chrome.storage
    chrome.storage.local.set({
      focusActive: false,
      focusEndTime: null,
      focusTask: null,
      taskData: null
    });
    
    // Clear any existing alarms
    chrome.alarms.clear("endFocus");
    
    // Remove blur from all tabs
    removeBlurFromAllTabs();
    
    sendResponse({ status: "Focus stopped" });
    currentTask = null;
  }
  
  if (msg.action === "takeBreak") {
    console.log('Received takeBreak message with duration:', msg.duration);
    onBreak = true;
    
    // Remove blur from all tabs immediately
    removeBlurFromAllTabs();
    
    // Also clear any pending alarms to prevent interference
    chrome.alarms.clear("endBreak");
    
    // Set a 1-minute timer to re-enable focus mode
    chrome.alarms.create("endBreak", { when: Date.now() + msg.duration });
    
    // Store break state
    chrome.storage.local.set({
      onBreak: true,
      breakEndTime: Date.now() + msg.duration
    });
    
    console.log('Break started, onBreak set to true');
    sendResponse({ success: true });
    return true; // Keep the message channel open for async response
  }
  
  // Return true if we might send a response asynchronously
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "endFocus") {
    focusActive = false;
    
    // Clear state in chrome.storage
    chrome.storage.local.set({
      focusActive: false,
      focusEndTime: null,
      focusTask: null,
      taskData: null
    });
    
    // Remove blur from all tabs when session ends
    removeBlurFromAllTabs();
    
    // Create notification with task information
    let notificationMessage = "Take a breather or start a new focus block!";
    if (currentTask) {
      notificationMessage = `Completed focus session on ${currentTask.key}. Time to take a break!`;
    }
    
    // Try to create notification
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Focus Session Complete!",
        message: notificationMessage
      });
    } catch (error) {
      console.log("Notifications not available:", error);
    }
    
    currentTask = null;
  }
  
  if (alarm.name === "endBreak") {
    onBreak = false;
    
    // Clear break state
    chrome.storage.local.set({
      onBreak: false,
      breakEndTime: null
    });
    
    // If focus is still active, re-apply blur to non-allowed sites
    if (focusActive) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
            const isAllowed = allowedSites.some(site => tab.url.includes(site));
            const isBlocked = blockedSites.some(site => tab.url.includes(site));
            
            if (isBlocked) {
              chrome.tabs.update(tab.id, { url: chrome.runtime.getURL("blocker.html") });
            } else if (!isAllowed) {
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: blurPageContent
              }).catch(err => {
                console.log("Could not re-blur page:", err);
              });
            }
          }
        });
      });
    }
  }
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (focusActive && details.frameId === 0) { // Only main frame
    const url = details.url;
    
    console.log('Navigation attempt:', url, 'focusActive:', focusActive, 'onBreak:', onBreak);
    
    // If on break, don't block anything
    if (onBreak) {
      console.log('On break - allowing navigation to:', url);
      return;
    }
    
    // Check if site should be completely blocked
    if (blockedSites.some(site => url.includes(site))) {
      console.log('Blocking navigation to:', url);
      chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocker.html") });
      return;
    }
    
    // Check if site is allowed (no blurring needed)
    const isAllowed = allowedSites.some(site => url.includes(site));
    
    if (!isAllowed) {
      console.log('Will blur:', url);
      // Site should be blurred - inject blur script after page loads
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: details.tabId },
          func: blurPageContent
        }).catch(err => {
          console.log("Could not blur page:", err);
        });
      }, 1000); // Small delay to ensure page content is loaded
    } else {
      console.log('Allowed site, no blur:', url);
    }
  }
});

// Listen for tab updates to handle SPA navigation and URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (focusActive && changeInfo.status === 'complete' && tab.url) {
    const url = tab.url;
    
    console.log('Tab updated:', url, 'focusActive:', focusActive, 'onBreak:', onBreak);
    
    // Skip chrome:// and extension pages
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return;
    }
    
    // If on break, don't block anything
    if (onBreak) {
      console.log('On break - allowing tab update to:', url);
      return;
    }
    
    // Check if site should be completely blocked
    if (blockedSites.some(site => url.includes(site))) {
      console.log('Blocking tab update to:', url);
      chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocker.html") });
      return;
    }
    
    // Check if site is allowed (no blurring needed)
    const isAllowed = allowedSites.some(site => url.includes(site));
    
    if (!isAllowed) {
      console.log('Will blur tab:', url);
      // Site should be blurred
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: blurPageContent
        }).catch(err => {
          console.log("Could not blur page:", err);
        });
      }, 500);
    } else {
      console.log('Allowed site, no blur for tab:', url);
    }
  }
});

// Function to blur page content
function blurPageContent() {
  // Check if already blurred to avoid double-blurring
  if (document.body.dataset.focusBlurred === 'true') {
    return;
  }
  
  // Create blur overlay
  const blurOverlay = document.createElement('div');
  blurOverlay.id = 'focus-blur-overlay';
  blurOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.3) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    pointer-events: none !important;
  `;
  
  // Create focus message
  const focusMessage = document.createElement('div');
  focusMessage.style.cssText = `
    background: rgba(255, 255, 255, 0.95) !important;
    padding: 30px 40px !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
    text-align: center !important;
    max-width: 400px !important;
    pointer-events: auto !important;
  `;
  
  focusMessage.innerHTML = `
    <div style="font-size: 24px; margin-bottom: 15px;">⏱️</div>
    <h3 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">Focus Mode Active</h3>
    <p style="margin: 0 0 15px 0; color: #666; font-size: 14px; line-height: 1.4;">
      This site is blurred to help you stay focused. You can still use it, but with reduced distraction.
    </p>
    <button id="focus-remove-blur" style="
      background: #4285f4;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      margin-right: 8px;
    ">Remove Blur (30s)</button>
    <button id="focus-minimize-blur" style="
      background: #666;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    ">Minimize</button>
  `;
  
  blurOverlay.appendChild(focusMessage);
  document.body.appendChild(blurOverlay);
  document.body.dataset.focusBlurred = 'true';
  
  // Handle remove blur button
  document.getElementById('focus-remove-blur').addEventListener('click', () => {
    blurOverlay.style.display = 'none';
    setTimeout(() => {
      if (blurOverlay.parentNode) {
        blurOverlay.style.display = 'flex';
      }
    }, 30000); // Show blur again after 30 seconds
  });
  
  // Handle minimize button
  document.getElementById('focus-minimize-blur').addEventListener('click', () => {
    focusMessage.style.display = 'none';
    blurOverlay.style.background = 'rgba(0, 0, 0, 0.1)';
    
    // Create small indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed !important;
      top: 20px !important;
      right: 20px !important;
      background: rgba(66, 133, 244, 0.9) !important;
      color: white !important;
      padding: 8px 12px !important;
      border-radius: 20px !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      z-index: 1000000 !important;
      cursor: pointer !important;
      pointer-events: auto !important;
    `;
    indicator.textContent = 'Focus Mode';
    indicator.addEventListener('click', () => {
      focusMessage.style.display = 'block';
      blurOverlay.style.background = 'rgba(0, 0, 0, 0.3)';
      indicator.remove();
    });
    
    blurOverlay.appendChild(indicator);
  });
}

// Function to remove blur from all tabs
function removeBlurFromAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: removeBlurFromPage
        }).catch(err => {
          // Ignore errors for tabs we can't access
        });
      }
    });
  });
}

// Function to remove blur from a page
function removeBlurFromPage() {
  const blurOverlay = document.getElementById('focus-blur-overlay');
  if (blurOverlay) {
    blurOverlay.remove();
  }
  if (document.body.dataset.focusBlurred) {
    delete document.body.dataset.focusBlurred;
  }
}
