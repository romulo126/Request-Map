let isCapturing = false;
let activeTabId = null;

// Objeto para armazenar os dados das requisições, indexados pelo requestId.
const requestsData = {};

/**
 * Captura o corpo da requisição (onBeforeRequest).
 */
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isCapturing || details.tabId !== activeTabId) return;

    if (!requestsData[details.requestId]) {
      requestsData[details.requestId] = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        initiator: details.initiator || 'N/A',
        timeStamp: details.timeStamp,
        statusCode: null,
        body: null,
        isWebSocket: (details.url.startsWith("ws:") || details.url.startsWith("wss:"))
      };
    }

    if (details.requestBody) {
      if (details.requestBody.formData) {
        requestsData[details.requestId].body = details.requestBody.formData;
      } else if (details.requestBody.raw && details.requestBody.raw.length > 0) {
        try {
          const decoder = new TextDecoder("utf-8");
          const rawData = details.requestBody.raw[0].bytes;
          requestsData[details.requestId].body = decoder.decode(rawData);
        } catch (e) {
          console.warn("Erro ao decodificar o corpo da requisição.", e);
        }
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

/**
 * Captura o status code quando a requisição é concluída (onCompleted).
 */
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!isCapturing || details.tabId !== activeTabId) return;

    if (requestsData[details.requestId]) {
      requestsData[details.requestId].statusCode = details.statusCode;
    } else {
      requestsData[details.requestId] = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        initiator: details.initiator || 'N/A',
        timeStamp: details.timeStamp,
        statusCode: details.statusCode,
        body: null,
        isWebSocket: (details.url.startsWith("ws:") || details.url.startsWith("wss:"))
      };
    }
  },
  { urls: ["<all_urls>"] }
);

/**
 * Comunicação com o pop-up e a página do mapa.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startCapture") {
    activeTabId = message.tabId;
    isCapturing = true;
    // Limpa dados anteriores
    for (const key in requestsData) {
      delete requestsData[key];
    }
    console.log("Captura iniciada na aba:", activeTabId);
    sendResponse({ status: "started" });
  } else if (message.action === "stopCapture") {
    isCapturing = false;
    console.log("Captura parada.");
    sendResponse({ status: "stopped" });
  } else if (message.action === "getStatus") {
    sendResponse({ isCapturing, activeTabId });
  } else if (message.action === "getRequests") {
    const allRequests = Object.values(requestsData);
    sendResponse({ requests: allRequests });
  }
});

chrome.runtime.onInstalled.addListener(reason => {
  if (reason.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      let thankYouPage = 'https://romulo126.github.io/My-Browser-Extensions/';
      chrome.tabs.create({ url: thankYouPage });
  }
  reloadTabs();
});
chrome.runtime.setUninstallURL("https://romulo126.github.io/My-Browser-Extensions/", () => {
  if (chrome.runtime.lastError) {
      console.error("Error setting uninstall URL:", chrome.runtime.lastError);
  }
});