import type { WebSocketMessage } from '@/types/websocket';

class ChatWebSocket {
  private ws: WebSocket | null = null;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private userId?: number;
  private messageQueue: WebSocketMessage[] = [];

  connect(userId: number) {
    if (!userId) {
      console.error('Cannot connect without userId');
      return;
    }

    this.userId = userId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}?type=chat&userId=${userId}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Process any queued messages
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        if (message) {
          this.send(message);
        }
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('Received WebSocket message:', message);
        this.messageHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (handlerError) {
            console.error('Error in message handler:', handlerError);
          }
        });
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.ws = null;
      this.isConnecting = false;

      // Only attempt to reconnect if we haven't exceeded the maximum attempts
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.userId) {
        console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.reconnectDelay *= 2; // Exponential backoff
          this.connect(this.userId!);
        }, this.reconnectDelay);
      } else {
        console.error('Max reconnection attempts reached or no userId available');
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
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
      try {
        console.log('Sending WebSocket message:', message);
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.messageQueue.push(message);
      }
    } else {
      console.log('WebSocket not connected, queueing message:', message);
      this.messageQueue.push(message);

      // Attempt to reconnect if not already connecting and we have a userId
      if (!this.isConnecting && this.userId && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.connect(this.userId);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers = [];
    this.messageQueue = [];
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.isConnecting = false;
    this.userId = undefined;
  }
}

export const chatWs = new ChatWebSocket();