let jm = null;

/**
 * Busca as requisições capturadas no background.
 */
function fetchCapturedRequests() {
  chrome.runtime.sendMessage({ action: "getRequests" }, (response) => {
    if (response && response.requests) {
      buildMindMap(response.requests);
    }
  });
}


function buildMindMap(requests) {
  // Estrutura base do mapa
  const mindData = {
    meta: {
      name: "requests_mindmap",
      author: "Extensão POC",
      version: "1.0"
    },
    format: "node_tree",
    data: {
      id: "root",
      topic: "Requisições",
      children: []
    }
  };

  const domainMap = {};

  requests.forEach((req) => {
    const urlObj = new URL(req.url);
    const domain = urlObj.hostname;

    if (!domainMap[domain]) {
      domainMap[domain] = [];
    }
    domainMap[domain].push(req);
  });

  // Para cada domínio, criamos um nó
  for (const domain in domainMap) {
    const domainNode = {
      id: `domain_${domain}`,
      topic: domain,
      children: []
    };

    // Para cada requisição no domínio, criamos um nó filho
    domainMap[domain].forEach((req, index) => {
      const childNode = {
        id: `req_${req.id}`,
        topic: `${req.method} - ${req.statusCode || "???"}`,
        data: {
          fullRequest: req
        },
        children: [
          {
            id: `req_${req.id}_url`,
            topic: req.url
          }
        ]
      };
      domainNode.children.push(childNode);
    });

    mindData.data.children.push(domainNode);
  }

  renderMindMap(mindData);
}

/**
 * Renderiza o mapa mental usando jsMind.
 */
function renderMindMap(mindData) {
  const options = {
    container: "jsmind_container",
    editable: false, 
    theme: "primary" 
  };

  // Destrói o mapa anterior, se existir
  if (jm) {
    jm.destroy();
    jm = null;
  }

  jm = new jsMind(options);
  jm.show(mindData);

  // Evento de clique em um nó
  jm.add_event_listener((type, data) => {
    if (type === jsMind.event_type.select_node) {
      const nodeData = data && data.node && data.node.data;
      if (nodeData && nodeData.fullRequest) {
        displayDetails(nodeData.fullRequest);
      } else {
        document.getElementById("details").textContent = "Nenhum detalhe disponível.";
      }
    }
  });
}

/**
 * Exibe os detalhes de uma requisição no painel inferior.
 */
function displayDetails(req) {
  const details = document.getElementById("details");
  details.textContent = JSON.stringify(req, null, 2);
}

/**
 * Exporta as requisições em JSON.
 */
function exportJSON() {
  chrome.runtime.sendMessage({ action: "getRequests" }, (response) => {
    if (response && response.requests) {
      const dataStr = JSON.stringify(response.requests, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "captured_requests.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  });
}

document.getElementById("export-json").addEventListener("click", exportJSON);

fetchCapturedRequests();
