(() => {
  const SEARCH_DEBOUNCE_MS = 150;
  const HIGHLIGHT_ALL_NAME = "search-all";
  const HIGHLIGHT_CURRENT_NAME = "search-current";

  const state = {
    isOpen: false,
    query: "",
    matches: [],
    currentIndex: -1,
    debounceTimer: null,
    highlightAll: null,
    highlightCurrent: null,
    changeUnsubscribe: null,
  };

  function supportsCustomHighlights() {
    return typeof CSS !== "undefined" && !!CSS.highlights && typeof Highlight === "function";
  }

  function getSearchElements() {
    return {
      bar: document.getElementById("search-bar"),
      input: document.getElementById("search-input"),
      matchCount: document.getElementById("search-match-count"),
      prevButton: document.getElementById("search-prev-btn"),
      nextButton: document.getElementById("search-next-btn"),
      closeButton: document.getElementById("search-close-btn"),
      editor: document.getElementById("wysiwyg-editor"),
      editorContainer: document.getElementById("editor-container"),
    };
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getSearchableTextNodes() {
    const { editor } = getSearchElements();
    if (!editor) {
      return [];
    }

    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.nodeValue && node.nodeValue.length > 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      },
    );

    const nodes = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      nodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    return nodes;
  }

  function findMatches(query) {
    if (!query) {
      return [];
    }

    const matcher = new RegExp(escapeRegExp(query), "gi");
    const ranges = [];

    getSearchableTextNodes().forEach((node) => {
      const text = node.nodeValue || "";
      matcher.lastIndex = 0;
      let match = matcher.exec(text);
      while (match) {
        if (match[0].length === 0) {
          matcher.lastIndex += 1;
          match = matcher.exec(text);
          continue;
        }

        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
        match = matcher.exec(text);
      }
    });

    return ranges;
  }

  function clearHighlights() {
    if (!supportsCustomHighlights()) {
      return;
    }

    CSS.highlights.delete(HIGHLIGHT_ALL_NAME);
    CSS.highlights.delete(HIGHLIGHT_CURRENT_NAME);
    state.highlightAll = null;
    state.highlightCurrent = null;
  }

  function applyHighlights() {
    clearHighlights();

    if (!supportsCustomHighlights() || state.matches.length === 0) {
      return;
    }

    state.highlightAll = new Highlight(...state.matches);
    if ("priority" in state.highlightAll) {
      state.highlightAll.priority = 1;
    }
    CSS.highlights.set(HIGHLIGHT_ALL_NAME, state.highlightAll);

    if (state.currentIndex < 0 || state.currentIndex >= state.matches.length) {
      return;
    }

    state.highlightCurrent = new Highlight(state.matches[state.currentIndex]);
    if ("priority" in state.highlightCurrent) {
      state.highlightCurrent.priority = 2;
    }
    CSS.highlights.set(HIGHLIGHT_CURRENT_NAME, state.highlightCurrent);
  }

  function updateMatchCount() {
    const { matchCount, prevButton, nextButton } = getSearchElements();
    if (!matchCount) {
      return;
    }

    const hasResults = state.matches.length > 0;
    if (prevButton) {
      prevButton.disabled = !hasResults;
    }
    if (nextButton) {
      nextButton.disabled = !hasResults;
    }

    if (!state.query) {
      matchCount.textContent = "";
      return;
    }

    if (state.matches.length === 0) {
      matchCount.textContent = "0 results";
      return;
    }

    matchCount.textContent = `${state.currentIndex + 1} of ${state.matches.length}`;
  }

  function scrollToCurrentMatch() {
    if (state.currentIndex < 0 || state.currentIndex >= state.matches.length) {
      return;
    }

    const { editorContainer } = getSearchElements();
    const currentMatch = state.matches[state.currentIndex];
    if (!currentMatch) {
      return;
    }

    if (!editorContainer) {
      currentMatch.startContainer.parentElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    const rangeRect = currentMatch.getBoundingClientRect();
    const containerRect = editorContainer.getBoundingClientRect();
    const targetTop =
      editorContainer.scrollTop +
      (rangeRect.top - containerRect.top) -
      editorContainer.clientHeight / 2 +
      rangeRect.height / 2;

    editorContainer.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }

  function executeSearch(nextQuery, options = {}) {
    const normalizedQuery = typeof nextQuery === "string" ? nextQuery : "";
    const preserveIndex = options.preserveIndex === true;

    state.query = normalizedQuery;

    if (!normalizedQuery) {
      state.matches = [];
      state.currentIndex = -1;
      clearHighlights();
      updateMatchCount();
      return;
    }

    const previousIndex = state.currentIndex;
    state.matches = findMatches(normalizedQuery);

    if (state.matches.length === 0) {
      state.currentIndex = -1;
    } else if (preserveIndex && previousIndex >= 0) {
      state.currentIndex = Math.min(previousIndex, state.matches.length - 1);
    } else {
      state.currentIndex = 0;
    }

    applyHighlights();
    updateMatchCount();

    if (state.currentIndex >= 0) {
      scrollToCurrentMatch();
    }
  }

  function goToNext() {
    if (state.matches.length === 0) {
      return;
    }

    if (state.currentIndex < 0) {
      state.currentIndex = 0;
    } else {
      state.currentIndex = (state.currentIndex + 1) % state.matches.length;
    }

    applyHighlights();
    updateMatchCount();
    scrollToCurrentMatch();
  }

  function goToPrevious() {
    if (state.matches.length === 0) {
      return;
    }

    if (state.currentIndex < 0) {
      state.currentIndex = 0;
    } else {
      state.currentIndex = (state.currentIndex - 1 + state.matches.length) % state.matches.length;
    }

    applyHighlights();
    updateMatchCount();
    scrollToCurrentMatch();
  }

  function onSearchInput() {
    const { input } = getSearchElements();
    if (!input) {
      return;
    }

    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(() => {
      executeSearch(input.value);
    }, SEARCH_DEBOUNCE_MS);
  }

  function onEditorContentChanged() {
    if (!state.isOpen) {
      return;
    }

    executeSearch(state.query, { preserveIndex: true });
  }

  function subscribeToEditorChanges() {
    if (state.changeUnsubscribe || typeof window.wysiwyg?.onChange !== "function") {
      return;
    }

    state.changeUnsubscribe = window.wysiwyg.onChange(onEditorContentChanged);
  }

  function unsubscribeFromEditorChanges() {
    if (typeof state.changeUnsubscribe === "function") {
      state.changeUnsubscribe();
    }
    state.changeUnsubscribe = null;
  }

  function isAnyModalOpen() {
    return Boolean(document.querySelector(".modal:not(.hidden), #mermaid-fullscreen-modal:not(.hidden)"));
  }

  function open() {
    const { bar, input } = getSearchElements();
    if (!bar || !input) {
      return;
    }

    state.isOpen = true;
    bar.classList.remove("hidden");
    subscribeToEditorChanges();

    input.focus();
    input.select();
    executeSearch(input.value, { preserveIndex: true });
  }

  function close() {
    const { bar, input } = getSearchElements();
    if (!bar || !input) {
      return;
    }

    state.isOpen = false;
    bar.classList.add("hidden");

    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = null;

    input.value = "";
    state.query = "";
    state.matches = [];
    state.currentIndex = -1;

    clearHighlights();
    updateMatchCount();
    unsubscribeFromEditorChanges();

    window.wysiwyg?.focus?.();
  }

  function handleGlobalKeydown(event) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const hasPrimaryModifier = isMac ? event.metaKey : event.ctrlKey;

    if (hasPrimaryModifier && event.key.toLowerCase() === "f") {
      event.preventDefault();
      open();
      return;
    }

    if (event.key === "Escape" && state.isOpen) {
      if (isAnyModalOpen()) {
        return;
      }

      event.preventDefault();
      close();
    }
  }

  function handleInputKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        goToPrevious();
        return;
      }

      goToNext();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  function handleDocumentPointerDown(event) {
    if (!state.isOpen) {
      return;
    }

    const { bar } = getSearchElements();
    if (!bar) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (bar.contains(target)) {
      return;
    }

    close();
  }

  function bindEvents() {
    const { input, prevButton, nextButton, closeButton } = getSearchElements();
    if (!input || !prevButton || !nextButton || !closeButton) {
      return;
    }

    input.addEventListener("input", onSearchInput);
    input.addEventListener("keydown", handleInputKeydown);
    prevButton.addEventListener("click", goToPrevious);
    nextButton.addEventListener("click", goToNext);
    closeButton.addEventListener("click", close);

    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("pointerdown", handleDocumentPointerDown);
    updateMatchCount();
  }

  window.markdownSearch = {
    open,
    close,
    executeSearch,
  };

  document.addEventListener("DOMContentLoaded", bindEvents);
})();
