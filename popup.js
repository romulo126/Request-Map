const tabUrlElement = document.getElementById('tab-url');
const statusElement = document.getElementById('status');
const toggleCaptureButton = document.getElementById('toggle-capture');
const openMapButton = document.getElementById('open-map');

let isCapturing = false;

// Atualiza a URL da aba ativa
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    const activeTab = tabs[0];
    tabUrlElement.textContent = activeTab.url;
    chrome.runtime.sendMessage({ action: "getStatus" }, (response) => {
      if (response && response.isCapturing && response.activeTabId === activeTab.id) {
        isCapturing = true;
        statusElement.textContent = "Ligado";
        toggleCaptureButton.textContent = "Desativar";
      }
    });
  }
});

// Alterna o estado da captura
toggleCaptureButton.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const activeTab = tabs[0];
      if (!isCapturing) {
        chrome.runtime.sendMessage({ action: "startCapture", tabId: activeTab.id }, () => {
          isCapturing = true;
          statusElement.textContent = "Ligado";
          statusElement.classList.remove("desativado");
          statusElement.classList.add("ativado");
          toggleCaptureButton.textContent = "Desativar";
        });
      } else {
        chrome.runtime.sendMessage({ action: "stopCapture" }, () => {
          isCapturing = false;
          statusElement.textContent = "Desligado";
          statusElement.classList.remove("ativado");
          statusElement.classList.add("desativado");
          toggleCaptureButton.textContent = "Ativar";
        });
      }
    }
  });
});

// Abre a página do mapa em uma nova aba
openMapButton.addEventListener("click", () => {
  chrome.tabs.create({ url: "index.html" });
});
