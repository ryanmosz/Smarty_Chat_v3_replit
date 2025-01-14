import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { channels, messages, users, directMessages, reactions } from "@db/schema";
import { eq, or, sql } from "drizzle-orm";
import { setupWebSocket } from "./websocket";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadsDir,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept all file types for now
    cb(null, true);
  },
});

export function registerRoutes(app: Express): Server {
  // Create HTTP server first
  const httpServer = createServer(app);

  // Setup WebSocket server
  const wss = setupWebSocket(httpServer);
  app.set('wss', wss);

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Channel routes
  app.get("/api/channels", async (_req, res) => {
    try {
      const allChannels = await db.select().from(channels);
      res.json(allChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
      res.status(500).json({ message: 'Failed to fetch channels' });
    }
  });

  // Channel messages route with user data and reactions
  app.get("/api/channels/:channelId/messages", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      if (isNaN(channelId)) {
        return res.status(400).json({ message: 'Invalid channel ID' });
      }

      const channelMessages = await db.query.messages.findMany({
        where: eq(messages.channelId, channelId),
        with: {
          user: true,
          reactions: {
            with: {
              user: true
            }
          }
        },
        orderBy: messages.createdAt,
      });

      res.json(channelMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Thread messages route with user data and reactions
  app.get("/api/messages/:messageId/thread", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      if (isNaN(messageId)) {
        return res.status(400).json({ message: 'Invalid message ID' });
      }

      const threadMessages = await db.query.messages.findMany({
        where: eq(messages.threadParentId, messageId),
        with: {
          user: true,
          reactions: {
            with: {
              user: true
            }
          }
        },
        orderBy: messages.createdAt,
      });

      res.json(threadMessages);
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      res.status(500).json({ message: 'Failed to fetch thread messages' });
    }
  });

  // Add route for reactions
  app.post("/api/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { emoji, userId } = req.body;

      if (isNaN(messageId)) {
        return res.status(400).json({ message: 'Invalid message ID' });
      }

      // Check if reaction already exists
      const existingReaction = await db.query.reactions.findFirst({
        where: sql`${reactions.messageId} = ${messageId} AND ${reactions.userId} = ${userId} AND ${reactions.emoji} = ${emoji}`
      });

      if (existingReaction) {
        // Remove reaction if it exists
        await db.delete(reactions)
          .where(eq(reactions.id, existingReaction.id))
          .returning();

        wss.broadcast({
          type: 'reaction_deleted',
          payload: { messageId, emoji, userId }
        });

        return res.json({ message: 'Reaction removed' });
      }

      // Add new reaction
      const [newReaction] = await db.insert(reactions)
        .values({ messageId, emoji, userId })
        .returning();

      const reactionWithUser = await db.query.reactions.findFirst({
        where: eq(reactions.id, newReaction.id),
        with: {
          user: true
        }
      });

      // Broadcast reaction to all connected clients
      wss.broadcast({
        type: 'reaction',
        payload: reactionWithUser
      });

      res.json(reactionWithUser);
    } catch (error) {
      console.error('Error handling reaction:', error);
      res.status(500).json({ message: 'Failed to handle reaction' });
    }
  });

  // Direct Message routes
  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await db.query.users.findMany();
      res.json(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get("/api/dm/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      const userMessages = await db.query.directMessages.findMany({
        where: (messages) => or(
          eq(messages.fromUserId, userId),
          eq(messages.toUserId, userId)
        ),
        with: {
          fromUser: true,
          toUser: true
        }
      });

      res.json(userMessages);
    } catch (error) {
      console.error('Error fetching direct messages:', error);
      res.status(500).json({ message: 'Failed to fetch direct messages' });
    }
  });

  // Add new route for active conversations
  app.get("/api/active-conversations", async (req, res) => {
    try {
      const allDirectMessages = await db.query.directMessages.findMany({
        with: {
          fromUser: true,
          toUser: true
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
      });

      // Get unique conversations (latest message for each user pair)
      const conversationMap = new Map<string, any>();
      allDirectMessages.forEach(dm => {
        if (dm.fromUserId && dm.toUserId) {
          const key = `${Math.min(dm.fromUserId, dm.toUserId)}-${Math.max(dm.fromUserId, dm.toUserId)}`;
          if (!conversationMap.has(key) && !dm.isDeleted) {
            conversationMap.set(key, dm);
          }
        }
      });

      const activeConversations = Array.from(conversationMap.values());
      res.json(activeConversations);
    } catch (error) {
      console.error('Error fetching active conversations:', error);
      res.status(500).json({ message: 'Failed to fetch active conversations' });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query?.trim()) {
        return res.json({ channels: [], messages: [], directMessages: [] });
      }

      const searchPattern = `%${query.toLowerCase()}%`;

      // Search messages with proper SQL pattern matching
      const foundMessages = await db.query.messages.findMany({
        where: sql`LOWER(${messages.content}) LIKE ${searchPattern} AND ${messages.isDeleted} = false`,
        with: {
          user: true,
          channel: {
            columns: {
              id: true,
              name: true
            }
          }
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)]
      });

      // Search direct messages
      const foundDirectMessages = await db.query.directMessages.findMany({
        where: sql`LOWER(${directMessages.content}) LIKE ${searchPattern} AND ${directMessages.isDeleted} = false`,
        with: {
          fromUser: true,
          toUser: true
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)]
      });

      // Transform dates to ISO strings and ensure all fields are properly formatted
      const response = {
        channels: [],
        messages: foundMessages.map(msg => ({
          ...msg,
          createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
          updatedAt: msg.updatedAt ? msg.updatedAt.toISOString() : null,
          user: msg.user || null,
          channel: msg.channel || null
        })),
        directMessages: foundDirectMessages.map(dm => ({
          ...dm,
          createdAt: dm.createdAt ? dm.createdAt.toISOString() : null,
          fromUser: dm.fromUser || null,
          toUser: dm.toUser || null
        }))
      };

      res.json(response);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        message: 'Failed to search',
        error: error instanceof Error ? error.message : 'Unknown error',
        channels: [],
        messages: [],
        directMessages: []
      });
    }
  });

  // Clean up WebSocket server on process exit
  process.on('SIGTERM', () => {
    wss.close();
    httpServer.close();
  });

  return httpServer;
}