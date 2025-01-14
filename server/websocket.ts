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

            (ws as WebSocketClient).userId = userId;
            wss.emit('connection', ws, request);
          } catch (error) {
            console.error('Error handling WebSocket upgrade:', error);
            socket.destroy();
          }
        });
      }
    }
  });

  wss.on('connection', async (ws: WebSocketClient) => {
    console.log('Chat WebSocket client connected, userId:', ws.userId);
    clients.add(ws);

    ws.on('message', async (data: string) => {
      let message: WebSocketMessage;
      try {
        message = JSON.parse(data);
        console.log('Received WebSocket message:', message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'error', payload: 'Invalid message format' }));
        return;
      }

      try {
        switch (message.type) {
          case 'reaction': {
            const { messageId, emoji, userId } = message.payload;
            if (!messageId || !emoji || !userId) {
              throw new Error('Missing required fields for reaction');
            }

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

            const existingReaction = await db.query.reactions.findFirst({
              where: sql`${reactions.messageId} = ${messageId} AND ${reactions.userId} = ${userId} AND ${reactions.emoji} = ${emoji}`
            });

            if (existingReaction) {
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

              if (!reactionWithUser) {
                throw new Error('Failed to fetch created reaction');
              }

              broadcast({ 
                type: 'reaction', 
                payload: {
                  ...reactionWithUser,
                  channelId: targetMessage.channelId,
                  threadParentId: targetMessage.threadParentId
                }
              });
            }
            break;
          }

          case 'message': {
            const { content, channelId, threadParentId, userId } = message.payload;
            if (!content || !channelId || !userId) {
              throw new Error('Missing required fields for message');
            }

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
                user: true,
                reactions: {
                  with: {
                    user: true
                  }
                }
              },
              limit: 1
            });

            if (!messageWithUser) {
              throw new Error('Failed to fetch created message');
            }

            broadcast({ type: 'message', payload: messageWithUser });
            break;
          }

          case 'direct_message': {
            const { content, fromUserId, toUserId } = message.payload;
            if (!content || !fromUserId || !toUserId) {
              throw new Error('Missing required fields for direct message');
            }

            const [newDM] = await db
              .insert(directMessages)
              .values({ 
                content, 
                fromUserId, 
                toUserId 
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

            if (!dmWithUsers) {
              throw new Error('Failed to fetch created direct message');
            }

            broadcast({ type: 'direct_message', payload: dmWithUsers });
            break;
          }

          case 'typing':
          case 'channel_created':
          case 'channel_deleted':
          case 'message_deleted':
          case 'direct_message_deleted':
          case 'user_status':
            broadcast(message);
            break;

          default:
            console.warn('Unknown message type:', message.type);
            ws.send(JSON.stringify({ 
              type: 'error', 
              payload: 'Unknown message type' 
            }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          payload: error instanceof Error ? error.message : 'Failed to process message' 
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