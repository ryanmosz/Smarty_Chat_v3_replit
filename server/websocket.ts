import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, directMessages, users } from '@db/schema';
import { parse as parseUrl } from 'url';
import { eq } from 'drizzle-orm';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'message_deleted' | 
        'direct_message' | 'direct_message_deleted' | 'user_status' | 'error';
  payload: any;
};

type WebSocketClient = WebSocket & {
  userId?: number;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    noServer: true 
  });

  const clients = new Set<WebSocketClient>();

  server.on('upgrade', (request, socket, head) => {
    const { pathname, query } = parseUrl(request.url || '', true);

    if (request.headers['sec-websocket-protocol'] === 'vite-hmr' || query.type === 'vite-hmr') {
      return;
    }

    if (query.type === 'chat') {
      const userId = parseInt(query.userId as string);
      if (!isNaN(userId)) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          (ws as WebSocketClient).userId = userId;
          wss.emit('connection', ws, request);
        });
      }
    }
  });

  wss.on('connection', async (ws: WebSocketClient) => {
    console.log('Chat WebSocket client connected, userId:', ws.userId);
    clients.add(ws);

    // Update user status to online
    if (ws.userId) {
      try {
        // Set both status and customStatus to online when connecting
        await db
          .update(users)
          .set({ 
            status: 'online',
            customStatus: 'online'
          })
          .where(eq(users.id, ws.userId));

        // Broadcast user status change
        broadcast({
          type: 'user_status',
          payload: {
            userId: ws.userId,
            status: 'online'
          }
        });
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    }

    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        console.log(`Received WebSocket message:`, message);

        switch (message.type) {
          case 'user_status': {
            const { userId, status } = message.payload;
            try {
              await db
                .update(users)
                .set({ 
                  status: status,
                  customStatus: status 
                })
                .where(eq(users.id, userId));

              broadcast({
                type: 'user_status',
                payload: { userId, status }
              });
            } catch (error) {
              console.error('Error updating user status:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to update status' 
              }));
            }
            break;
          }
          case 'message': {
            const { content, channelId, threadParentId, userId } = message.payload;

            try {
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
            } catch (error) {
              console.error('Error creating message:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to create message' 
              }));
            }
            break;
          }

          case 'message_deleted': {
            const { id } = message.payload;
            try {
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

              const [deletedMessage] = await db
                .delete(messages)
                .where(eq(messages.id, id))
                .returning();

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

          case 'direct_message': {
            const { content, fromUserId, toUserId } = message.payload;

            try {
              const [newDM] = await db
                .insert(directMessages)
                .values({ 
                  content, 
                  fromUserId, 
                  toUserId,
                })
                .returning();

              const [dmWithUsers] = await db.query.directMessages.findMany({
                where: eq(directMessages.id, newDM.id),
                with: {
                  fromUser: true,
                  toUser: true
                },
                limit: 1
              });

              broadcast({ type: 'direct_message', payload: dmWithUsers });
            } catch (error) {
              console.error('Error creating direct message:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to create direct message' 
              }));
            }
            break;
          }

          case 'direct_message_deleted': {
            const { id } = message.payload;
            try {
              const [existingDM] = await db.query.directMessages.findMany({
                where: eq(directMessages.id, id),
                limit: 1
              });

              if (!existingDM) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  payload: 'Direct message not found' 
                }));
                return;
              }

              const [deletedDM] = await db
                .delete(directMessages)
                .where(eq(directMessages.id, id))
                .returning();

              broadcast({ 
                type: 'direct_message_deleted', 
                payload: { 
                  id, 
                  fromUserId: deletedDM.fromUserId,
                  toUserId: deletedDM.toUserId 
                } 
              });
            } catch (error) {
              console.error('Error deleting direct message:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to delete direct message' 
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

    ws.on('close', async () => {
      console.log('WebSocket client disconnected, userId:', ws.userId);
      clients.delete(ws);

      // Update user status to offline
      if (ws.userId) {
        try {
          await db
            .update(users)
            .set({ 
              status: 'offline',
              customStatus: 'offline' 
            })
            .where(eq(users.id, ws.userId));

          // Broadcast user status change
          broadcast({
            type: 'user_status',
            payload: {
              userId: ws.userId,
              status: 'offline'
            }
          });
        } catch (error) {
          console.error('Error updating user status:', error);
        }
      }
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