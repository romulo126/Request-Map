// Global para persistir o estado de colapso dos nós (chave: domínio ou outro identificador)
let collapseStates = {};

// Cores padrão para métodos; se houver preferências salvas, elas serão carregadas
let methodColors = {
  GET: { background: "#ecf0f1", color: "#2c3e50" },
  POST: { background: "#3498db", color: "#ffffff" },
  PUT: { background: "#f39c12", color: "#ffffff" },
  DELETE: { background: "#e74c3c", color: "#ffffff" },
  PATCH: { background: "#9b59b6", color: "#ffffff" },
  WS: { background: "#2ecc71", color: "#ffffff" }
};

function loadColorPreferences() {
  const prefs = localStorage.getItem("methodColors");
  if (prefs) {
    methodColors = JSON.parse(prefs);
  }
}

function saveColorPreferences() {
  localStorage.setItem("methodColors", JSON.stringify(methodColors));
}

// Inicializa preferências de cor
loadColorPreferences();

/**
 * Busca as requisições capturadas.
 */
function fetchCapturedRequests(callback) {
  chrome.runtime.sendMessage({ action: "getRequests" }, (response) => {
    if (response && response.requests) {
      callback(response.requests);
    } else {
      callback([]);
    }
  });
}

/**
 * Constrói a estrutura de árvore agrupando as requisições por domínio.
 */
function buildMindMapData(requests) {
  const root = {
    text: "Requisições Capturadas",
    children: []
  };

  const domainMap = {};
  requests.forEach(req => {
    try {
      const domain = new URL(req.url).hostname;
      if (!domainMap[domain]) {
        domainMap[domain] = [];
      }
      domainMap[domain].push(req);
    } catch (e) {
      console.warn("URL inválida:", req.url);
    }
  });

  for (const domain in domainMap) {
    const domainNode = {
      text: domain,
      children: [],
      collapsed: collapseStates[domain] || false
    };

    domainMap[domain].forEach(req => {
      // Se for websocket, usamos "WS" como método
      const method = req.isWebSocket ? "WS" : req.method;
      const reqNode = {
        text: `${method} - ${req.statusCode || "???"}`,
        data: req,  // dados completos para exibição
        children: [
          { text: req.url }
        ]
      };
      domainNode.children.push(reqNode);
    });

    root.children.push(domainNode);
  }

  return root;
}

/**
 * Função recursiva para posicionar os nós.
 */
function buildPositions(node, x, y, spacingX, spacingY) {
  node.x = x;
  node.y = y;

  if (!node.children || node.children.length === 0 || node.collapsed) {
    return 1;
  }

  let totalHeight = 0;
  node.children.forEach(child => {
    const used = buildPositions(child, x + spacingX, y + totalHeight * spacingY, spacingX, spacingY);
    totalHeight += used;
  });

  return totalHeight;
}

/**
 * Renderiza o mapa mental.
 */
function renderMindmap(mindData) {
  const container = document.getElementById("mindmap-container");
  const svg = document.getElementById("mindmap-lines");

  // Limpa nós e linhas anteriores
  container.querySelectorAll(".node").forEach(el => el.remove());
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }

  // Calcula posições
  buildPositions(mindData, 50, 50, 250, 60);

  // Função recursiva para criar os nós e botões
  function traverse(node) {
    // Cria elemento do nó
    const nodeEl = document.createElement("div");
    nodeEl.className = "node";
    nodeEl.textContent = node.text;
    nodeEl.style.left = node.x + "px";
    nodeEl.style.top = node.y + "px";

    // Se o nó tiver dados (uma requisição), personaliza a cor conforme o método
    if (node.data && node.data.method) {
      const method = node.data.isWebSocket ? "WS" : node.data.method;
      // Aplica cor padrão conforme o método
      if (methodColors[method]) {
        nodeEl.style.backgroundColor = methodColors[method].background;
        nodeEl.style.color = methodColors[method].color;
      }
      // Se o statusCode existir e for 500 ou mais, sobrepõe com vermelho
      if (node.data.statusCode && node.data.statusCode >= 500) {
        nodeEl.style.backgroundColor = "#e74c3c"; // vermelho
        nodeEl.style.color = "#ffffff";
      }
    }

    // Se o nó possuir filhos, adiciona botão de toggle para expandir/colapsar
    if (node.children && node.children.length > 0) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "toggle-btn";
      toggleBtn.textContent = node.collapsed ? "+" : "–";
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        node.collapsed = !node.collapsed;
        collapseStates[node.text] = node.collapsed;
        renderMindmap(mindData); // re-renderiza mantendo os novos estados
      });
      nodeEl.appendChild(toggleBtn);
    }

    // Se o nó tiver dados, adiciona botão de "info" para ver detalhes completos na div flutuante
    if (node.data) {
      const infoBtn = document.createElement("button");
      infoBtn.className = "info-btn";
      infoBtn.textContent = "i";
      infoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showFloatingDetails(node.data);
      });
      nodeEl.appendChild(infoBtn);
    }

    // Removemos a ação de clique padrão para exibir dados na div inferior.
    // Assim, os detalhes só serão mostrados na div flutuante ao clicar no botão "info".

    container.appendChild(nodeEl);

    // Se o nó não estiver colapsado, percorre os filhos
    if (node.children && !node.collapsed) {
      node.children.forEach(child => {
        drawConnection(node, child);
        traverse(child);
      });
    }
  }

  // Função para desenhar linhas entre nós
  function drawConnection(parent, child) {
    const nodeWidth = 120;  
    const nodeHeight = 40;

    const parentCenterX = parent.x + nodeWidth / 2;
    const parentCenterY = parent.y + nodeHeight / 2;
    const childCenterX = child.x + nodeWidth / 2;
    const childCenterY = child.y + nodeHeight / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", parentCenterX);
    line.setAttribute("y1", parentCenterY);
    line.setAttribute("x2", childCenterX);
    line.setAttribute("y2", childCenterY);
    line.setAttribute("stroke", "#3498db");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }

  traverse(mindData);
}

/**
 * Exporta os dados capturados em JSON.
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

/**
 * Exporta o conteúdo do mapa em JPG usando html2canvas.
 */
function exportJPG() {
  const container = document.getElementById("mindmap-container");
  html2canvas(container).then(canvas => {
    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    const a = document.createElement("a");
    a.href = imgData;
    a.download = "mindmap.jpg";
    a.click();
  });
}

/**
 * Exibe uma div flutuante com os detalhes completos da requisição.
 */
function showFloatingDetails(data) {
  const floating = document.getElementById("floating-details");
  const pre = document.getElementById("full-request-content");
  pre.textContent = JSON.stringify(data, null, 2);
  floating.classList.remove("hidden");
}

/**
 * Fecha a div flutuante de detalhes.
 */
function closeFloatingDetails() {
  document.getElementById("floating-details").classList.add("hidden");
}

/**
 * Atualiza o mapa: busca requisições, constrói a árvore e renderiza.
 */
function updateMindmap() {
  fetchCapturedRequests((requests) => {
    const mindData = buildMindMapData(requests);
    renderMindmap(mindData);
  });
}

// Configura os botões da toolbar
document.getElementById("export-json").addEventListener("click", exportJSON);
document.getElementById("export-jpg").addEventListener("click", exportJPG);
document.getElementById("refresh-map").addEventListener("click", updateMindmap);

// Botão para fechar a div flutuante de detalhes
document.getElementById("close-floating").addEventListener("click", closeFloatingDetails);

// Auto-atualiza o mapa a cada 10 segundos sem perder os dados e o estado de colapso
setInterval(updateMindmap, 10000);

/* Configurações de cores */
// Abre o painel de configurações
document.getElementById("settings-btn").addEventListener("click", () => {
  openSettingsPanel();
});

function openSettingsPanel() {
  const panel = document.getElementById("settings-panel");
  const container = document.getElementById("color-settings");
  container.innerHTML = ""; // limpa configurações anteriores

  // Para cada método, cria inputs para background e texto
  Object.keys(methodColors).forEach(method => {
    const div = document.createElement("div");
    div.innerHTML = `<label>${method}</label>
      Fundo: <input type="color" id="bg-${method}" value="${methodColors[method].background}">
      Texto: <input type="color" id="text-${method}" value="${methodColors[method].color}">`;
    container.appendChild(div);
  });

  panel.classList.remove("hidden");
}

// Salva as preferências e fecha o painel
document.getElementById("save-settings").addEventListener("click", () => {
  Object.keys(methodColors).forEach(method => {
    const bg = document.getElementById("bg-" + method).value;
    const txt = document.getElementById("text-" + method).value;
    methodColors[method] = { background: bg, color: txt };
  });
  saveColorPreferences();
  document.getElementById("settings-panel").classList.add("hidden");
  updateMindmap();
});

// Cancela e fecha o painel
document.getElementById("cancel-settings").addEventListener("click", () => {
  document.getElementById("settings-panel").classList.add("hidden");
});

// Atualiza o mapa assim que a página é carregada
window.addEventListener("load", updateMindmap);
