function getAccessToken(callback) {
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error("Failed to get auth token:", chrome.runtime.lastError.message);
      return;
    }
    callback(token);
  });
}

function fetchFreeSlots(token, callback) {
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
    .then((response) => response.json())
    .then((data) => {
      console.log("Busy slots:", data.calendars.primary.busy);
      callback(data.calendars.primary.busy);
    })
    .catch((error) => {
      console.error("Error fetching free slots:", error);
    });
}

// Example usage
getAccessToken((token) => {
  fetchFreeSlots(token, (busySlots) => {
    console.log("Busy slots:", busySlots);
    // Analyze busy slots and suggest focus times
  });
});
