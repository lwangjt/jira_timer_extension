let focusActive = false;
let blockedSites = ["youtube.com", "twitter.com", "facebook.com", "instagram.com", "tiktok.com"];
let focusEndTime = null;
let currentTask = null;
let gapiInitialized = false;

// Load the Google API script in the background service worker
function loadGoogleApiScript(callback) {
  if (gapiInitialized) {
    callback();
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://apis.google.com/js/api.js';
  script.onload = () => {
    gapi.load('client:auth2', () => {
      gapi.client.init({
        apiKey: 'YOUR_API_KEY',
        clientId: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        scope: 'https://www.googleapis.com/auth/calendar.events',
      }).then(() => {
        gapiInitialized = true;
        console.log('Google API initialized');
        callback();
      }).catch((error) => {
        console.error('Error initializing Google API:', error);
      });
    });
  };
  script.onerror = () => console.error('Failed to load Google API script');
  document.head.appendChild(script);
}

// Handle OAuth2 authentication using chrome.identity
function authenticateUser(callback) {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get auth token:", chrome.runtime.lastError.message);
      callback(null); // Pass null to indicate failure
      return;
    }
    if (!token) {
      console.error("No token retrieved");
      callback(null); // Pass null to indicate failure
      return;
    }

    // Validate the token to ensure it's still valid
    fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`)
      .then(response => {
        if (!response.ok) {
          throw new Error("Invalid token");
        }
        return response.json();
      })
      .then(() => {
        callback(token); // Token is valid
      })
      .catch(() => {
        console.warn("Token is invalid, removing cached token");
        chrome.identity.removeCachedAuthToken({ token }, () => {
          callback(null); // Pass null to indicate failure
        });
      });
  });
}

function findFreeSlots(token, callback) {
  const now = new Date().toISOString();
  const later = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week from now

  fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timeMin: now,
      timeMax: later,
      items: [{ id: 'primary' }]
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.calendars && data.calendars.primary && data.calendars.primary.busy) {
        const busySlots = data.calendars.primary.busy;
        const freeSlots = calculateFreeSlots(busySlots, now, later);
        callback(freeSlots);
      } else {
        console.error("Unexpected API response format:", data);
        callback([]);
      }
    })
    .catch(error => {
      console.error('Error fetching free slots:', error);
      callback([]);
    });
}

function calculateFreeSlots(busySlots, start, end) {
  const freeSlots = [];
  let lastEnd = new Date(start);

  busySlots.forEach(slot => {
    const busyStart = new Date(slot.start);
    if (busyStart > lastEnd) {
      freeSlots.push({ start: lastEnd, end: busyStart });
    }
    lastEnd = new Date(slot.end);
  });

  if (lastEnd < new Date(end)) {
    freeSlots.push({ start: lastEnd, end: new Date(end) });
  }

  return freeSlots;
}

function scheduleFocusBlock(token, start, end) {
  gapi.client.setToken({ access_token: token });

  gapi.client.load('calendar', 'v3').then(() => {
    gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: 'Focus Time',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      }
    }).then(() => {
      console.log('Focus block scheduled:', start, end);
    }).catch(error => console.error('Error scheduling focus block:', error));
  });
}

// Handle messages from the extension
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

    chrome.storage.local.set({
      focusActive: true,
      focusEndTime: focusEndTime,
      focusTask: msg.taskKey,
      taskData: currentTask // Ensure task data is stored
    }, () => {
      console.log("Task data saved to storage:", currentTask);
    });

    chrome.alarms.create("endFocus", { when: focusEndTime });
    sendResponse({ status: `Focus started for ${msg.duration} min on ${msg.taskKey}` });
  }

  if (msg.command === "STOP_FOCUS") {
    focusActive = false;
    focusEndTime = null;

    chrome.storage.local.set({
      focusActive: false,
      focusEndTime: null,
      focusTask: null,
      taskData: null
    });

    chrome.alarms.clear("endFocus");
    sendResponse({ status: "Focus stopped" });
    currentTask = null;
  }

  if (msg.command === "SYNC_CALENDAR") {
    authenticateUser((token) => {
      if (!token) {
        sendResponse({ status: "Failed to authenticate user" });
        return;
      }

      findFreeSlots(token, (freeSlots) => {
        sendResponse({ status: "Calendar synced", freeSlots });
      });
    });
    return true; // Keep the message channel open for async response
  }

  if (msg.command === "SCHEDULE_FOCUS") {
    const { start, end } = msg;
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error("Failed to get auth token:", chrome.runtime.lastError.message);
        sendResponse({ status: "Failed to get auth token" });
        return;
      }

      scheduleFocusBlock(token, new Date(start), new Date(end));
      sendResponse({ status: "Focus block scheduled" });
    });
    return true; // Keep the message channel open for async response
  }

  if (msg.command === "SUGGEST_FOCUS_TIME") {
    // Hardcoded free slots for August 1st
    const hardcodedFreeSlots = [
      { start: "2023-08-01T09:00:00", end: "2023-08-01T10:00:00" },
      { start: "2023-08-01T10:45:00", end: "2023-08-01T12:30:00" },
      { start: "2023-08-01T13:00:00", end: "2023-08-01T14:00:00" }
    ];

    console.log("Suggested free slots for August 1st:", hardcodedFreeSlots);
    sendResponse({ status: "Free slots found", freeSlots: hardcodedFreeSlots });
    return true; // Keep the message channel open for async response
  }

  if (msg.command === "SCHEDULE_MULTIPLE_FOCUS_BLOCKS") {
    const { blocks } = msg; // Array of focus blocks to schedule
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: "Failed to get auth token" });
        return;
      }

      blocks.forEach(block => {
        const start = new Date(block.start);
        const end = new Date(block.end);
        scheduleFocusBlock(token, start, end);
      });

      // Store scheduled blocks in chrome.storage
      chrome.storage.local.get({ scheduledBlocks: [] }, (data) => {
        const updatedBlocks = [...data.scheduledBlocks, ...blocks];
        chrome.storage.local.set({ scheduledBlocks: updatedBlocks }, () => {
          sendResponse({ status: "Focus blocks scheduled", scheduledBlocks: updatedBlocks });
        });
      });
    });
    return true; // Keep the message channel open for async response
  }

  if (msg.command === "GET_CURRENT_TASK") {
    chrome.storage.local.get(["taskData"], (data) => {
      if (data.taskData) {
        sendResponse({ status: "Task retrieved", task: data.taskData });
      } else {
        sendResponse({ status: "No active task" });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "endFocus") {
    focusActive = false;

    chrome.storage.local.set({
      focusActive: false,
      focusEndTime: null,
      focusTask: null,
      taskData: null
    });

    let notificationMessage = "Take a breather or start a new focus block!";
    if (currentTask) {
      notificationMessage = `Completed focus session on ${currentTask.key}. Time to take a break!`;
    }

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Focus Session Complete!",
      message: notificationMessage
    });

    currentTask = null;
  }
});

// Ensure the webNavigation listener is registered correctly
if (chrome.webNavigation && chrome.webNavigation.onBeforeNavigate) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    // Exclude Google OAuth URLs from being redirected
    if (details.url.includes('accounts.google.com') || details.url.includes('oauth2')) {
      return;
    }

    if (focusActive && blockedSites.some(site => details.url.includes(site))) {
      chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL("blocker.html") });
    }
  });
} else {
  console.error("chrome.webNavigation.onBeforeNavigate is not available. Ensure the 'webNavigation' permission is added to manifest.json.");
}
