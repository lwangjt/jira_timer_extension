const input = document.getElementById('blockedSitesInput');
const saveBtn = document.getElementById('saveBtn');

chrome.storage.sync.get(['blockedSites'], (data) => {
  if (data.blockedSites) {
    input.value = data.blockedSites.join(', ');
  }
});

saveBtn.addEventListener('click', () => {
  const sites = input.value.split(',').map(s => s.trim());
  chrome.storage.sync.set({ blockedSites: sites }, () => {
    alert('Saved!');
  });
});
v