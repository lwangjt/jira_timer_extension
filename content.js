chrome.runtime.onMessage.addListener((msg) => {
  if (msg.command === "GRAY_OUT") {
    document.body.style.filter = "grayscale(100%)";
  }
});
