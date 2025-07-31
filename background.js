let focusActive = false;
let blockedSites = ["youtube.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com"];
let focusEndTime = null;
let currentTask = null;

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
    
    sendResponse({ status: "Focus stopped" });
    currentTask = null;
  }
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
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (focusActive && blockedSites.some(site => details.url.includes(site))) {
    chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocker.html") });
  }
});
