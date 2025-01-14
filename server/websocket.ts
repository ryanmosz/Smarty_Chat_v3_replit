import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, directMessages, users, reactions } from '@db/schema';
import { parse as parseUrl } from 'url';
import { eq, sql } from 'drizzle-orm';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'message_deleted' | 
        'direct_message' | 'direct_message_deleted' | 'reaction' | 'reaction_deleted' | 'error' | 'user_status';
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
        wss.handleUpgrade(request, socket, head, async (ws) => {
          try {
            await db
              .update(users)
              .set({ 
                status: 'online',
                customStatus: 'online'
              })
              .where(eq(users.id, userId));

            broadcast({
              type: 'user_status',
              payload: {
                userId,
                status: 'online'
              }
            });
          } catch (error) {
            console.error('Error setting initial user status:', error);
          }

          (ws as WebSocketClient).userId = userId;
          wss.emit('connection', ws, request);
        });
      }
    }
  });

  wss.on('connection', async (ws: WebSocketClient) => {
    console.log('Chat WebSocket client connected, userId:', ws.userId);
    clients.add(ws);

    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        console.log(`Received WebSocket message:`, message);

        switch (message.type) {
          case 'reaction': {
            const { messageId, emoji, userId } = message.payload;

            try {
              // Check if reaction already exists
              const existingReaction = await db.query.reactions.findFirst({
                where: sql`${reactions.messageId} = ${messageId} AND ${reactions.userId} = ${userId} AND ${reactions.emoji} = ${emoji}`
              });

              // Get message context first to include in broadcast
              const [targetMessage] = await db.query.messages.findMany({
                where: eq(messages.id, messageId),
                with: {
                  user: true,
                  channel: true
                },
                limit: 1
              });

              if (!targetMessage) {
                ws.send(JSON.stringify({ 
                  type: 'error', 
                  payload: 'Message not found' 
                }));
                return;
              }

              if (existingReaction) {
                // Remove reaction if it exists
                await db.delete(reactions)
                  .where(eq(reactions.id, existingReaction.id));

                broadcast({
                  type: 'reaction_deleted',
                  payload: { 
                    messageId, 
                    emoji, 
                    userId,
                    channelId: targetMessage.channelId,
                    threadParentId: targetMessage.threadParentId
                  }
                });
              } else {
                // Add new reaction
                const [newReaction] = await db
                  .insert(reactions)
                  .values({ messageId, emoji, userId })
                  .returning();

                const reactionWithUser = await db.query.reactions.findFirst({
                  where: eq(reactions.id, newReaction.id),
                  with: {
                    user: true
                  }
                });

                if (reactionWithUser) {
                  broadcast({ 
                    type: 'reaction', 
                    payload: {
                      ...reactionWithUser,
                      channelId: targetMessage.channelId,
                      threadParentId: targetMessage.threadParentId
                    }
                  });
                }
              }
            } catch (error) {
              console.error('Error handling reaction:', error);
              ws.send(JSON.stringify({ 
                type: 'error', 
                payload: 'Failed to handle reaction' 
              }));
            }
            break;
          }
          case 'message':
          case 'typing':
          case 'direct_message':
          case 'user_status':
          case 'channel_created':
          case 'channel_deleted':
          case 'message_deleted':
          case 'direct_message_deleted':
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

      if (ws.userId) {
        try {
          await db
            .update(users)
            .set({ 
              status: 'offline',
              customStatus: 'offline' 
            })
            .where(eq(users.id, ws.userId));

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
    console.log('Broadcasting message:', message);
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