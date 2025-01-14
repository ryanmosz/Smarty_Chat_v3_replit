import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, directMessages, users } from '@db/schema';
import { parse as parseUrl } from 'url';
import { eq, lt } from 'drizzle-orm';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'message_deleted' | 
         'direct_message' | 'direct_message_deleted' | 'reaction' | 'error' | 'user_status';
  payload: any;
};

type WebSocketClient = WebSocket & {
  userId?: number;
  lastActive?: Date;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<number, WebSocketClient>();
  const INACTIVE_TIMEOUT = 120000; // 2 minutes

  // Update inactive users every minute
  const inactiveInterval = setInterval(() => {
    const twoMinutesAgo = new Date(Date.now() - INACTIVE_TIMEOUT);

    // Convert Map entries to array for iteration
    Array.from(clients.entries()).forEach(([userId, client]) => {
      const lastActive = client.lastActive || new Date(0);

      if (lastActive < twoMinutesAgo) {
        try {
          db.update(users)
            .set({ 
              status: 'offline',
              customStatus: 'offline',
              lastActive: new Date()
            })
            .where(eq(users.id, userId))
            .then(() => {
              broadcast({
                type: 'user_status',
                payload: { userId, status: 'offline' }
              });

              // Clean up inactive client
              if (client.readyState === WebSocket.OPEN) {
                client.close();
              }
              clients.delete(userId);
            })
            .catch(error => {
              console.error('Error handling inactive user:', error);
            });
        } catch (error) {
          console.error('Error handling inactive user:', error);
        }
      }
    });
  }, 60000); // Check every minute

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parseUrl(request.url || '', true);

    // Ignore vite-hmr connections
    if (request.headers['sec-websocket-protocol'] === 'vite-hmr' || query.type === 'vite-hmr') {
      socket.destroy();
      return;
    }

    if (query.type === 'chat') {
      const userId = parseInt(query.userId as string);
      if (!isNaN(userId)) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          const client = ws as WebSocketClient;
          client.userId = userId;
          client.lastActive = new Date();

          // Set initial online status
          db.update(users)
            .set({ 
              status: 'online',
              customStatus: 'online',
              lastActive: new Date()
            })
            .where(eq(users.id, userId))
            .then(() => {
              clients.set(userId, client);
              broadcast({
                type: 'user_status',
                payload: { userId, status: 'online' }
              });
              wss.emit('connection', client);
            })
            .catch(error => {
              console.error('Error setting initial user status:', error);
              socket.destroy();
            });
        });
      } else {
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocketClient) => {
    ws.on('message', (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        if (ws.userId) {
          ws.lastActive = new Date();
          const client = clients.get(ws.userId);
          if (client) {
            client.lastActive = new Date();
          }
        }

        // Forward all messages
        broadcast(message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        db.update(users)
          .set({ 
            status: 'offline',
            customStatus: 'offline',
            lastActive: new Date()
          })
          .where(eq(users.id, ws.userId))
          .then(() => {
            broadcast({
              type: 'user_status',
              payload: {
                userId: ws.userId,
                status: 'offline'
              }
            });
          })
          .catch(error => {
            console.error('Error updating user status on disconnect:', error);
          });
      }
    });

    ws.on('error', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
      }
    });
  });

  function broadcast(message: WebSocketMessage) {
    // Convert Map values to array for iteration
    Array.from(clients.values()).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    });
  }

  // Clean up on server shutdown
  const cleanup = () => {
    clearInterval(inactiveInterval);

    // Convert Map entries to array for iteration
    Array.from(clients.entries()).forEach(([userId, client]) => {
      db.update(users)
        .set({ 
          status: 'offline',
          customStatus: 'offline',
          lastActive: new Date()
        })
        .where(eq(users.id, userId))
        .catch(error => {
          console.error('Error updating user status during cleanup:', error);
        });

      if (client.readyState === WebSocket.OPEN) {
        try {
          client.close();
        } catch (error) {
          console.error('Error closing client during cleanup:', error);
        }
      }
    });

    clients.clear();
    wss.close();
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  return {
    broadcast,
    close: cleanup
  };
}