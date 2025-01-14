import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, users } from '@db/schema';
import { parse as parseUrl } from 'url';
import { eq } from 'drizzle-orm';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'message_deleted' | 'error';
  payload: any;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true 
  });

  const clients = new Set<WebSocket>();

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parseUrl(request.url || '', true);

    if (request.headers['sec-websocket-protocol'] === 'vite-hmr' || query.type === 'vite-hmr') {
      return;
    }

    if (query.type === 'chat') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('Chat WebSocket client connected');
    clients.add(ws);

    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        console.log(`Received WebSocket message:`, message);

        switch (message.type) {
          case 'message': {
            const { content, channelId, threadParentId, userId } = message.payload;

            const [newMessage] = await db
              .insert(messages)
              .values({ 
                content, 
                channelId, 
                threadParentId,
                userId 
              })
              .returning();

            const [messageWithUser] = await db.query.messages.findMany({
              where: eq(messages.id, newMessage.id),
              with: {
                user: true
              },
              limit: 1
            });

            broadcast({ type: 'message', payload: messageWithUser });
            break;
          }

          case 'message_deleted': {
            const { id } = message.payload;
            try {
              // First check if the message exists
              const [existingMessage] = await db.query.messages.findMany({
                where: eq(messages.id, id),
                limit: 1
              });

              if (!existingMessage) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  payload: 'Message not found' 
                }));
                return;
              }

              // Delete the message
              const [deletedMessage] = await db
                .delete(messages)
                .where(eq(messages.id, id))
                .returning();

              // Broadcast the deletion to all clients
              broadcast({ 
                type: 'message_deleted', 
                payload: { id, channelId: deletedMessage.channelId } 
              });
            } catch (error) {
              console.error('Error deleting message:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to delete message' 
              }));
            }
            break;
          }

          case 'typing':
          case 'channel_created':
          case 'channel_deleted':
            broadcast(message);
            break;

          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              payload: 'Unknown message type' 
            }));
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

    deadClients.forEach(client => {
      clients.delete(client);
    });
  }

  return {
    broadcast,
    close: () => wss.close()
  };
}
