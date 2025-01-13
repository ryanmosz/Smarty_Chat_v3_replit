import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, channels, reactions } from '@db/schema';
import { eq } from 'drizzle-orm';

type WebSocketClient = WebSocket & {
  userId?: number;
  isAlive?: boolean;
};

type WebSocketMessage = {
  type: 'message' | 'typing' | 'reaction' | 'delete_message' | 'channel_created' | 'channel_deleted';
  payload: any;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    verifyClient: (info, cb) => {
      // Always allow Vite HMR WebSocket connections
      if (info.req.headers['sec-websocket-protocol'] === 'vite-hmr') {
        cb(true);
        return;
      }

      // For chat connections, verify authentication
      const req = info.req as any;
      if (!req.session?.passport?.user) {
        cb(false, 401, 'Unauthorized');
        return;
      }

      cb(true);
    }
  });

  const clients = new Map<WebSocketClient, { userId: number }>();

  function heartbeat(this: WebSocketClient) {
    this.isAlive = true;
  }

  const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocketClient) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws: WebSocketClient, req: any) => {
    // Skip session handling for Vite HMR connections
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      return;
    }

    ws.isAlive = true;
    ws.on('pong', heartbeat);

    // Get user ID from session
    const userId = req.session?.passport?.user;
    if (userId) {
      ws.userId = userId;
      clients.set(ws, { userId });
    }

    ws.on('message', async (data: string) => {
      if (!ws.userId) return;

      try {
        const message: WebSocketMessage = JSON.parse(data);

        switch (message.type) {
          case 'message':
            const { content, channelId, threadParentId } = message.payload;
            const [newMessage] = await db.insert(messages)
              .values({ 
                content, 
                channelId, 
                userId: ws.userId,
                threadParentId 
              })
              .returning();

            broadcast({ type: 'message', payload: newMessage });
            break;

          case 'typing':
            const { channelId: typingChannelId } = message.payload;
            broadcast({
              type: 'typing',
              payload: { userId: ws.userId, channelId: typingChannelId }
            });
            break;

          case 'reaction':
            const { messageId, emoji } = message.payload;
            const [reaction] = await db.insert(reactions)
              .values({ messageId, userId: ws.userId, emoji })
              .returning();

            broadcast({ type: 'reaction', payload: reaction });
            break;

          case 'delete_message':
            const { id } = message.payload;
            const [deletedMessage] = await db
              .select()
              .from(messages)
              .where(eq(messages.id, id))
              .limit(1);

            if (deletedMessage && deletedMessage.userId === ws.userId) {
              await db.update(messages)
                .set({ isDeleted: true })
                .where(eq(messages.id, id));

              broadcast({ type: 'delete_message', payload: { id } });
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function broadcast(message: WebSocketMessage) {
    const deadClients: WebSocketClient[] = [];

    wss.clients.forEach((client: WebSocketClient) => {
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
      try {
        client.terminate();
      } catch (error) {
        console.error('Error terminating client:', error);
      }
    });
  }

  return {
    broadcast,
    close: () => {
      clearInterval(interval);
      wss.close();
    }
  };
}