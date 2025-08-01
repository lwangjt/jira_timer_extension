// Add event listeners for buttons
document.getElementById('close-tab').addEventListener('click', () => {
  window.close();
});

document.getElementById('sync-calendar').addEventListener('click', () => {
  chrome.runtime.sendMessage({ command: "SYNC_CALENDAR" }, (response) => {
    if (response && response.status === "Calendar synced") {
      const events = response.events;
      const eventList = document.getElementById('event-list');
      eventList.innerHTML = ''; // Clear existing events
      events.forEach(event => {
        const listItem = document.createElement('li');
        listItem.textContent = `${event.summary} (${event.start.dateTime || event.start.date})`;
        eventList.appendChild(listItem);
      });
      alert("Calendar synced successfully!");
    } else {
      alert("Failed to sync calendar. Please try again.");
    }
  });
});

document.getElementById('suggest-focus-time').addEventListener('click', () => {
  console.log("Suggest Focus Time button clicked"); // Debugging log
  chrome.runtime.sendMessage({ command: "SUGGEST_FOCUS_TIME" }, (response) => {
    if (response && response.status === "Free slots found") {
      console.log("Free slots received:", response.freeSlots); // Debugging log
      const freeSlots = response.freeSlots;
      const freeSlotList = document.getElementById('free-slot-list');
      freeSlotList.innerHTML = ''; // Clear existing slots
      freeSlots.forEach(slot => {
        const listItem = document.createElement('li');
        listItem.textContent = `Free from ${new Date(slot.start).toLocaleString()} to ${new Date(slot.end).toLocaleString()}`;
        freeSlotList.appendChild(listItem);
      });
      alert("Free slots suggested successfully!");
    } else {
      console.error("Failed to suggest focus time:", response); // Debugging log
      alert("Failed to suggest focus time. Please try again.");
    }
  });
});