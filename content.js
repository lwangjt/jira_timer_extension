chrome.runtime.onMessage.addListener((msg) => {
  if (msg.command === "GRAY_OUT") {
    document.body.style.filter = "grayscale(100%)";
  }
  
  if (msg.command === "BLUR_CONTENT") {
    // This is handled by the background script injection
    // but keeping this as fallback
    document.body.style.filter = "blur(2px)";
  }
  
  if (msg.command === "REMOVE_BLUR") {
    document.body.style.filter = "none";
    const blurOverlay = document.getElementById('focus-blur-overlay');
    if (blurOverlay) {
      blurOverlay.remove();
    }
  }
});
