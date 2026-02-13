(() => {
  const RECONNECT_BASE_DELAY_MS = 1000;
  const RECONNECT_MAX_DELAY_MS = 10000;

  const websocketState = {
    socket: null,
    reconnectDelayMs: RECONNECT_BASE_DELAY_MS,
    manualClose: false,
  };

  function websocketUrl() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }

  function notifyConnectionStatus(status) {
    window.dispatchEvent(
      new CustomEvent("markdown-os:websocket-status", {
        detail: { status },
      }),
    );
  }

  function connectWebSocket() {
    websocketState.manualClose = false;
    websocketState.socket = new WebSocket(websocketUrl());
    notifyConnectionStatus("connecting");

    websocketState.socket.onopen = () => {
      websocketState.reconnectDelayMs = RECONNECT_BASE_DELAY_MS;
      notifyConnectionStatus("connected");
    };

    websocketState.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "file_changed") {
          return;
        }

        window.dispatchEvent(
          new CustomEvent("markdown-os:file-changed", {
            detail: payload,
          }),
        );
      } catch (error) {
        console.error("Invalid websocket message payload.", error);
      }
    };

    websocketState.socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      notifyConnectionStatus("error");
    };

    websocketState.socket.onclose = () => {
      notifyConnectionStatus("disconnected");
      if (websocketState.manualClose) {
        return;
      }

      const delay = websocketState.reconnectDelayMs;
      window.setTimeout(connectWebSocket, delay);
      websocketState.reconnectDelayMs = Math.min(
        websocketState.reconnectDelayMs * 2,
        RECONNECT_MAX_DELAY_MS,
      );
    };
  }

  function closeWebSocket() {
    websocketState.manualClose = true;
    if (!websocketState.socket) {
      return;
    }
    websocketState.socket.close();
  }

  window.markdownOSWebSocket = {
    closeWebSocket,
    connectWebSocket,
  };

  window.addEventListener("beforeunload", closeWebSocket);
  document.addEventListener("DOMContentLoaded", connectWebSocket);
})();
