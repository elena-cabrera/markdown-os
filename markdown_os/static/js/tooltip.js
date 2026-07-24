(() => {
  window.MarkdownOS = window.MarkdownOS || {};

  const SHOW_DELAY_MS = 400;
  const GAP_PX = 8;
  const VIEWPORT_PAD_PX = 8;
  const SHORTCUT_KEY_PATTERN =
    /^(?:Ctrl|Control|Alt|Option|Shift|Cmd|Command|Meta|Win|Super|Esc|Escape|Enter|Return|Tab|Space|Backspace|Delete|Del|Home|End|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|F\d{1,2}|[A-Za-z0-9]|[,.`~\!@#\$%\^&\*\(\)\-_=\+\[\]\{\}\\|;:'"<>\/\?])$/i;

  let tooltipEl = null;
  let labelEl = null;
  let keysEl = null;
  let showTimer = null;
  let activeTarget = null;
  let attributeObserver = null;

  function normalizeKeyLabel(key) {
    const lower = key.toLowerCase();
    if (lower === "control") {
      return "Ctrl";
    }
    if (lower === "escape") {
      return "Esc";
    }
    if (lower === "command" || lower === "cmd" || lower === "meta") {
      return "Cmd";
    }
    if (lower === "return") {
      return "Enter";
    }
    if (lower === "delete" || lower === "del") {
      return "Del";
    }
    if (lower === " ") {
      return "Space";
    }
    if (key.length === 1) {
      return key.toUpperCase();
    }
    if (/^esc$/i.test(key)) {
      return "Esc";
    }
    if (/^ctrl$/i.test(key)) {
      return "Ctrl";
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function parseTooltipText(raw) {
    const text = String(raw || "").trim();
    if (!text) {
      return { label: "", keys: [] };
    }

    const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!match) {
      return { label: text, keys: [] };
    }

    const label = match[1].trim();
    const shortcut = match[2].trim();
    if (!label || !shortcut) {
      return { label: text, keys: [] };
    }

    const parts = shortcut
      .split("+")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0 || !parts.every((part) => SHORTCUT_KEY_PATTERN.test(part))) {
      return { label: text, keys: [] };
    }

    return {
      label,
      keys: parts.map(normalizeKeyLabel),
    };
  }

  function ensureTooltipEl() {
    if (tooltipEl) {
      return tooltipEl;
    }

    tooltipEl = document.createElement("div");
    tooltipEl.className = "app-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    tooltipEl.id = "app-tooltip";
    tooltipEl.hidden = true;

    labelEl = document.createElement("span");
    labelEl.className = "app-tooltip-label";

    keysEl = document.createElement("span");
    keysEl.className = "app-tooltip-keys";

    tooltipEl.appendChild(labelEl);
    tooltipEl.appendChild(keysEl);
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function clearShowTimer() {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
  }

  function disconnectAttributeObserver() {
    if (attributeObserver) {
      attributeObserver.disconnect();
      attributeObserver = null;
    }
  }

  function readTooltipText(target) {
    if (!(target instanceof Element)) {
      return "";
    }
    return (
      target.getAttribute("data-tooltip") ||
      target.getAttribute("title") ||
      ""
    ).trim();
  }

  function migrateTitle(target) {
    if (!(target instanceof Element) || !target.hasAttribute("title")) {
      return;
    }

    const title = target.getAttribute("title");
    if (title == null || title === "") {
      target.removeAttribute("title");
      return;
    }

    target.setAttribute("data-tooltip", title);
    target.removeAttribute("title");
  }

  function renderTooltipContent(rawText) {
    const parsed = parseTooltipText(rawText);
    ensureTooltipEl();

    labelEl.textContent = parsed.label;
    keysEl.innerHTML = "";

    if (parsed.keys.length === 0) {
      keysEl.hidden = true;
      return parsed.label.length > 0;
    }

    keysEl.hidden = false;
    parsed.keys.forEach((key) => {
      const kbd = document.createElement("kbd");
      kbd.className = "app-tooltip-kbd";
      kbd.textContent = key;
      keysEl.appendChild(kbd);
    });
    return true;
  }

  function positionTooltip(target) {
    ensureTooltipEl();
    const anchor = target.getBoundingClientRect();
    const tip = tooltipEl.getBoundingClientRect();
    const maxLeft = window.innerWidth - tip.width - VIEWPORT_PAD_PX;
    let left = anchor.left + anchor.width / 2 - tip.width / 2;
    left = Math.max(VIEWPORT_PAD_PX, Math.min(left, maxLeft));

    let top = anchor.top - tip.height - GAP_PX;
    let placement = "top";
    if (top < VIEWPORT_PAD_PX) {
      top = anchor.bottom + GAP_PX;
      placement = "bottom";
      const maxTop = window.innerHeight - tip.height - VIEWPORT_PAD_PX;
      top = Math.max(VIEWPORT_PAD_PX, Math.min(top, maxTop));
    }

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.dataset.placement = placement;
  }

  function observeTarget(target) {
    disconnectAttributeObserver();
    if (!(target instanceof Element) || typeof MutationObserver === "undefined") {
      return;
    }

    attributeObserver = new MutationObserver(() => {
      if (activeTarget !== target) {
        return;
      }
      migrateTitle(target);
      const text = readTooltipText(target);
      if (!text || !renderTooltipContent(text)) {
        hide();
        return;
      }
      positionTooltip(target);
    });
    attributeObserver.observe(target, {
      attributes: true,
      attributeFilter: ["title", "data-tooltip"],
    });
  }

  function hide() {
    clearShowTimer();
    disconnectAttributeObserver();
    activeTarget = null;
    if (!tooltipEl) {
      return;
    }
    tooltipEl.hidden = true;
    tooltipEl.classList.remove("is-visible");
  }

  function showNow(target) {
    migrateTitle(target);
    const text = readTooltipText(target);
    if (!text || !renderTooltipContent(text)) {
      hide();
      return;
    }

    ensureTooltipEl();
    activeTarget = target;
    tooltipEl.hidden = false;
    tooltipEl.classList.add("is-visible");
    positionTooltip(target);
    observeTarget(target);
  }

  function scheduleShow(target) {
    clearShowTimer();
    if (activeTarget && activeTarget !== target) {
      hide();
    }
    showTimer = window.setTimeout(() => {
      showTimer = null;
      showNow(target);
    }, SHOW_DELAY_MS);
  }

  function findTooltipTarget(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    if (tooltipEl && tooltipEl.contains(node)) {
      return null;
    }
    return node.closest("[title], [data-tooltip]");
  }

  function onPointerOver(event) {
    if (event.pointerType === "touch") {
      return;
    }
    const target = findTooltipTarget(event.target);
    if (!target || target === activeTarget) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) {
      return;
    }
    scheduleShow(target);
  }

  function onPointerOut(event) {
    const target = findTooltipTarget(event.target);
    if (!target) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) {
      return;
    }
    if (activeTarget === target || showTimer !== null) {
      hide();
    }
  }

  function onFocusIn(event) {
    const target = findTooltipTarget(event.target);
    if (!target) {
      return;
    }
    scheduleShow(target);
  }

  function onFocusOut(event) {
    const target = findTooltipTarget(event.target);
    if (!target) {
      return;
    }
    const related = event.relatedTarget;
    if (related instanceof Node && target.contains(related)) {
      return;
    }
    if (activeTarget === target || showTimer !== null) {
      hide();
    }
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      hide();
    }
  }

  function onScrollOrResize() {
    if (activeTarget) {
      positionTooltip(activeTarget);
    }
  }

  function init() {
    ensureTooltipEl();
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.MarkdownOS.tooltip = {
    hide,
    parseTooltipText,
    show(target) {
      if (target instanceof Element) {
        showNow(target);
      }
    },
  };
})();
