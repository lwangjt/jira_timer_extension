// Take break function
function takeBreak() {
  // Send message to extension immediately to disable restrictions
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      action: 'takeBreak',
      duration: 60000
    }, (response) => {
      // After break is activated, navigate away
      navigateAway();
    });
  } else {
    // Fallback if extension not available
    navigateAway();
  }
}

// Close tab function
function closeTab() {
  try {
    // Try window.close first
    window.close();
    
    // If still here after 100ms, try other methods
    setTimeout(() => {
      // Try to navigate to about:blank
      window.location.href = 'about:blank';
      
      // Also try chrome API if available
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.getCurrent((tab) => {
          if (tab) {
            chrome.tabs.remove(tab.id);
          }
        });
      }
    }, 100);
    
  } catch (error) {
    // Ultimate fallback
    window.location.replace('about:blank');
  }
}

// Simple navigation function
function navigateAway() {
  try {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://www.google.com';
    }
  } catch (error) {
    // Fallback - try to change URL directly
    window.location.replace('https://www.google.com');
  }
}

// Wait for DOM to load then bind events
document.addEventListener('DOMContentLoaded', function() {
  const breakBtn = document.getElementById('breakBtn');
  const closeBtn = document.getElementById('closeBtn');
  
  if (breakBtn) {
    breakBtn.addEventListener('click', takeBreak);
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeTab);
  }
});

// Fallback: bind events immediately if DOM is already loaded
if (document.readyState !== 'loading') {
  const breakBtn = document.getElementById('breakBtn');
  const closeBtn = document.getElementById('closeBtn');
  
  if (breakBtn) {
    breakBtn.onclick = takeBreak;
  }
  
  if (closeBtn) {
    closeBtn.onclick = closeTab;
  }
}
