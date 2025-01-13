import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '@db';
import { messages, channels, reactions, directMessages } from '@db/schema';
import { eq, and } from 'drizzle-orm';

type WebSocketMessage = {
  type: 'message' | 'typing' | 'reaction' | 'delete_message';
  payload: any;
};

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });
  
  const clients = new Map<WebSocket, { userId: number }>();

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (data: string) => {
      try {
        const message: WebSocketMessage = JSON.parse(data);
        
        switch (message.type) {
          case 'message':
            const { content, channelId, userId, threadParentId } = message.payload;
            const [newMessage] = await db.insert(messages)
              .values({ content, channelId, userId, threadParentId })
              .returning();
              
            // Broadcast to all connected clients
            broadcast({ type: 'message', payload: newMessage });
            break;
            
          case 'typing':
            const { user, channel } = message.payload;
            broadcast({
              type: 'typing',
              payload: { userId: user.id, channelId: channel.id }
            });
            break;
            
          case 'reaction':
            const { messageId, emoji, reactingUserId } = message.payload;
            const [reaction] = await db.insert(reactions)
              .values({ messageId, userId: reactingUserId, emoji })
              .returning();
              
            broadcast({ type: 'reaction', payload: reaction });
            break;
            
          case 'delete_message':
            const { id } = message.payload;
            await db.update(messages)
              .set({ isDeleted: true })
              .where(eq(messages.id, id));
              
            broadcast({ type: 'delete_message', payload: { id } });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  function broadcast(message: WebSocketMessage) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}
