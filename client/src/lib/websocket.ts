type WebSocketMessage = {
  type: string;
  payload: any;
};

class ChatWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.messageHandlers.forEach(handler => handler(message));
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 1000);
    };
  }

  subscribe(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const chatWs = new ChatWebSocket();
