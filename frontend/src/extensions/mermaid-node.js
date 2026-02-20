const panZoomKey = "data-panzoom-initialized";
const mermaidThemeByAppTheme = {
  light: "default",
  dark: "dark",
  dracula: "dark",
  "nord-light": "neutral",
  "nord-dark": "dark",
  lofi: "neutral",
};

let initializedTheme = null;
let fullscreenPanZoomInstance = null;

function currentMermaidTheme() {
  const appTheme = document.documentElement.getAttribute("data-theme");
  return mermaidThemeByAppTheme[appTheme] || "default";
}

function ensureMermaidInitialized() {
  if (!window.mermaid) {
    return false;
  }

  const theme = currentMermaidTheme();
  if (initializedTheme === theme) {
    return true;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme,
    useMaxWidth: false,
  });
  initializedTheme = theme;
  return true;
}

function renderMermaidError(container, source) {
  container.innerHTML = "";
  const errorElement = document.createElement("div");
  errorElement.className = "mermaid-error";
  errorElement.textContent = `Invalid mermaid syntax:\n${source}`;
  container.appendChild(errorElement);
}

function enablePanZoom(container) {
  if (!window.svgPanZoom) {
    return;
  }

  const svg = container.querySelector("svg");
  if (!svg || svg.getAttribute(panZoomKey) === "true") {
    return;
  }

  const instance = window.svgPanZoom(svg, {
    controlIconsEnabled: false,
    zoomScaleSensitivity: 0.4,
    minZoom: 0.5,
    maxZoom: 20,
    fit: true,
    center: true,
  });
  svg.setAttribute(panZoomKey, "true");
  container._panZoomInstance = instance;
}

function closeFullscreenMermaid() {
  const overlay = document.getElementById("mermaid-fullscreen-overlay");
  const modal = document.getElementById("mermaid-fullscreen-modal");
  const content = document.getElementById("mermaid-fullscreen-content");
  if (!overlay || !modal || !content) {
    return;
  }

  if (fullscreenPanZoomInstance) {
    fullscreenPanZoomInstance.destroy();
    fullscreenPanZoomInstance = null;
  }

  overlay.classList.add("hidden");
  modal.classList.add("hidden");
  content.innerHTML = "";
}

function bindFullscreenControls() {
  if (window.__markdownOSMermaidFullscreenBound) {
    return;
  }

  const overlay = document.getElementById("mermaid-fullscreen-overlay");
  const closeButton = document.getElementById("mermaid-fullscreen-close");
  const zoomIn = document.getElementById("mermaid-zoom-in");
  const zoomOut = document.getElementById("mermaid-zoom-out");
  const zoomReset = document.getElementById("mermaid-zoom-reset");

  overlay?.addEventListener("click", closeFullscreenMermaid);
  closeButton?.addEventListener("click", closeFullscreenMermaid);
  zoomIn?.addEventListener("click", () => {
    fullscreenPanZoomInstance?.zoomIn();
  });
  zoomOut?.addEventListener("click", () => {
    fullscreenPanZoomInstance?.zoomOut();
  });
  zoomReset?.addEventListener("click", () => {
    const instance = fullscreenPanZoomInstance;
    if (!instance) {
      return;
    }
    instance.resetZoom();
    instance.resetPan();
    instance.fit();
    instance.center();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeFullscreenMermaid();
    }
  });

  window.__markdownOSMermaidFullscreenBound = true;
}

async function openFullscreenMermaid(source, fallbackSvg) {
  const overlay = document.getElementById("mermaid-fullscreen-overlay");
  const modal = document.getElementById("mermaid-fullscreen-modal");
  const content = document.getElementById("mermaid-fullscreen-content");
  if (!overlay || !modal || !content) {
    return;
  }

  bindFullscreenControls();
  content.innerHTML = "";

  let svgElement = null;
  if (source && ensureMermaidInitialized()) {
    try {
      const renderId = `mermaid-fullscreen-${Date.now()}`;
      const { svg } = await window.mermaid.render(renderId, source);
      content.innerHTML = svg;
      svgElement = content.querySelector("svg");
    } catch (_error) {
      svgElement = null;
    }
  }

  if (!svgElement && fallbackSvg instanceof SVGElement) {
    const clone = fallbackSvg.cloneNode(true);
    if (clone instanceof SVGElement) {
      clone.removeAttribute(panZoomKey);
      clone.removeAttribute("style");
      content.appendChild(clone);
      svgElement = clone;
    }
  }

  if (!svgElement) {
    return;
  }

  svgElement.style.width = "100%";
  svgElement.style.height = "100%";
  svgElement.style.maxWidth = "none";

  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");

  if (window.svgPanZoom) {
    fullscreenPanZoomInstance = window.svgPanZoom(svgElement, {
      controlIconsEnabled: false,
      zoomScaleSensitivity: 0.4,
      minZoom: 0.2,
      maxZoom: 40,
      fit: false,
      center: true,
    });
    fullscreenPanZoomInstance.center();
  }
}

function attachFullscreenButton(container, source) {
  let button = container.querySelector(".mermaid-fullscreen-trigger");
  if (button) {
    return;
  }

  button = document.createElement("button");
  button.type = "button";
  button.className = "mermaid-fullscreen-trigger";
  button.textContent = "⛶";
  button.setAttribute("aria-label", "View diagram fullscreen");
  button.title = "View fullscreen";
  button.addEventListener("click", () => {
    const svg = container.querySelector("svg");
    openFullscreenMermaid(source, svg);
  });
  container.appendChild(button);
}

function normalizeMermaidSvgSize(container) {
  const svg = container.querySelector("svg");
  if (!svg) {
    return;
  }

  svg.style.maxWidth = "none";
  svg.style.width = "100%";

  try {
    const bbox = svg.getBBox();
    const containerWidth = container.clientWidth || container.offsetWidth;
    if (bbox.width > 0 && containerWidth > 0) {
      const naturalHeight = containerWidth * (bbox.height / bbox.width);
      svg.style.height = `${Math.ceil(naturalHeight)}px`;
    }
  } catch (_error) {
    // Ignore detached SVG getBBox failures.
  }
}

async function renderMermaidNodeView(container, source) {
  if (!container) {
    return;
  }

  container.classList.add("mermaid-container");
  container.dataset.mermaidSource = source;

  if (!ensureMermaidInitialized()) {
    renderMermaidError(container, source);
    return;
  }

  const renderToken = String(Date.now() + Math.random());
  container.dataset.renderToken = renderToken;

  try {
    const renderId = `mermaid-node-${Math.round(Math.random() * 1_000_000)}`;
    const { svg } = await window.mermaid.render(renderId, source);
    if (container.dataset.renderToken !== renderToken) {
      return;
    }

    container.innerHTML = svg;
    normalizeMermaidSvgSize(container);
    enablePanZoom(container);
    attachFullscreenButton(container, source);
  } catch (_error) {
    if (container.dataset.renderToken !== renderToken) {
      return;
    }
    renderMermaidError(container, source);
  }
}

function rerenderMermaidNodeViews(root = document) {
  const containers = root.querySelectorAll(".mermaid-container[data-mermaid-source]");
  containers.forEach((container) => {
    renderMermaidNodeView(container, container.dataset.mermaidSource || "");
  });
}

export {
  closeFullscreenMermaid,
  renderMermaidNodeView,
  rerenderMermaidNodeViews,
};
