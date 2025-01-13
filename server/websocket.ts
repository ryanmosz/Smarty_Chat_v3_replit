import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, channels } from '@db/schema';
import { eq } from 'drizzle-orm';
import { parse as parseUrl } from 'url';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted';
  payload: any;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    verifyClient: (info, cb) => {
      // Always allow Vite HMR WebSocket connections
      const { query } = parseUrl(info.req.url || '', true);
      if (info.req.headers['sec-websocket-protocol'] === 'vite-hmr' || query.type === 'vite-hmr') {
        cb(true);
        return;
      }

      // For chat connections, always allow for now since we removed auth
      cb(true);
    }
  });

  // Keep track of connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket, req) => {
    // Skip handling for Vite HMR connections
    const { query } = parseUrl(req.url || '', true);
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr' || query.type === 'vite-hmr') {
      return;
    }

    console.log('Chat WebSocket client connected');
    clients.add(ws);

    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        console.log(`Received WebSocket message: ${message.type}`);

        switch (message.type) {
          case 'message':
            const { content, channelId } = message.payload;
            const [newMessage] = await db.insert(messages)
              .values({ content, channelId })
              .returning();

            broadcast({ type: 'message', payload: newMessage });
            break;

          case 'typing':
            const { channelId: typingChannelId } = message.payload;
            broadcast({
              type: 'typing',
              payload: { channelId: typingChannelId }
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message processing error:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: 'Failed to process message' 
        }));
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket client error:', error);
      clients.delete(ws);
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });
  });

  function broadcast(message: WebSocketMessage) {
    const deadClients: WebSocket[] = [];

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Broadcast error:', error);
          deadClients.push(client);
        }
      } else {
        deadClients.push(client);
      }
    });

    // Clean up dead clients
    deadClients.forEach(client => {
      clients.delete(client);
    });
  }

  return {
    broadcast,
    close: () => wss.close()
  };
}