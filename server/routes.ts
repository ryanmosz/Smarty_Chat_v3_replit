import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { channels, messages, users, directMessages } from "@db/schema";
import { eq, or, sql, ilike } from "drizzle-orm";
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

  // Channel messages route with user data
  app.get("/api/channels/:channelId/messages", async (req, res) => {
    try {
      const channelId = parseInt(req.params.channelId);
      if (isNaN(channelId)) {
        return res.status(400).json({ message: 'Invalid channel ID' });
      }

      const channelMessages = await db.query.messages.findMany({
        where: eq(messages.channelId, channelId),
        with: {
          user: true
        },
        orderBy: messages.createdAt,
      });

      res.json(channelMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // Thread messages route
  app.get("/api/messages/:messageId/thread", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      if (isNaN(messageId)) {
        return res.status(400).json({ message: 'Invalid message ID' });
      }

      const threadMessages = await db.query.messages.findMany({
        where: eq(messages.threadParentId, messageId),
        with: {
          user: true
        },
        orderBy: messages.createdAt,
      });

      res.json(threadMessages);
    } catch (error) {
      console.error('Error fetching thread messages:', error);
      res.status(500).json({ message: 'Failed to fetch thread messages' });
    }
  });

  app.post("/api/channels", async (req, res) => {
    try {
      const { name, description } = req.body;
      const [channel] = await db.insert(channels)
        .values({ name, description })
        .returning();

      // Broadcast channel creation to all connected clients
      wss.broadcast({
        type: 'channel_created',
        payload: channel
      });

      res.json(channel);
    } catch (error) {
      console.error('Error creating channel:', error);
      res.status(500).json({ message: 'Failed to create channel' });
    }
  });

  app.delete("/api/channels/:id", async (req, res) => {
    const channelId = parseInt(req.params.id);
    if (isNaN(channelId)) {
      return res.status(400).json({ message: 'Invalid channel ID' });
    }

    try {
      // Use a transaction to ensure both operations succeed or fail together
      await db.transaction(async (tx) => {
        // First, delete all messages in the channel
        await tx.delete(messages)
          .where(eq(messages.channelId, channelId));

        // Then delete the channel
        const [deletedChannel] = await tx.delete(channels)
          .where(eq(channels.id, channelId))
          .returning();

        if (!deletedChannel) {
          throw new Error('Channel not found');
        }
      });

      // If we get here, both operations succeeded
      // Broadcast channel deletion to all connected clients
      wss.broadcast({
        type: 'channel_deleted',
        payload: { id: channelId }
      });

      res.json({ message: 'Channel deleted successfully' });
    } catch (err) {
      const error = err as Error;
      console.error('Error deleting channel:', error);
      if (error.message === 'Channel not found') {
        res.status(404).json({ message: 'Channel not found' });
      } else {
        res.status(500).json({ message: 'Failed to delete channel' });
      }
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


  // Add search endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query?.trim()) {
        return res.json({ channels: [], messages: [], directMessages: [] });
      }

      const likeQuery = `%${query}%`;

      // Search channels
      const foundChannels = await db
        .select()
        .from(channels)
        .where(ilike(channels.name, likeQuery))
        .limit(5);

      // Search messages with user data
      const foundMessages = await db.query.messages.findMany({
        where: ilike(messages.content, likeQuery),
        with: {
          user: true
        },
        limit: 5
      });

      // Search direct messages with user data
      const foundDirectMessages = await db.query.directMessages.findMany({
        where: ilike(directMessages.content, likeQuery),
        with: {
          fromUser: true,
          toUser: true
        },
        limit: 5
      });

      res.json({
        channels: foundChannels || [],
        messages: foundMessages || [],
        directMessages: foundDirectMessages || []
      });
    } catch (error) {
      console.error('Error searching:', error);
      res.status(500).json({ 
        message: 'Failed to search',
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