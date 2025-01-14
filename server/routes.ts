import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { channels, messages, users, directMessages, emojis, emojiCategories, reactions } from "@db/schema";
import { eq, or, sql, and, desc } from "drizzle-orm";
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
    // Accept images for emoji uploads
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (file.fieldname === 'emoji' && !allowedTypes.includes(file.mimetype)) {
      cb(null, false);
      return;
    }
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

  // New Emoji Category Routes
  app.get("/api/emoji-categories", async (_req, res) => {
    try {
      const categories = await db.query.emojiCategories.findMany({
        with: {
          emojis: true,
        },
        orderBy: (categories) => [categories.displayOrder],
      });
      res.json(categories);
    } catch (error) {
      console.error('Error fetching emoji categories:', error);
      res.status(500).json({ message: 'Failed to fetch emoji categories' });
    }
  });

  app.post("/api/emoji-categories", async (req, res) => {
    try {
      const { name, description, displayOrder } = req.body;
      const [category] = await db.insert(emojiCategories)
        .values({ name, description, displayOrder })
        .returning();
      res.json(category);
    } catch (error) {
      console.error('Error creating emoji category:', error);
      res.status(500).json({ message: 'Failed to create emoji category' });
    }
  });

  // Emoji Routes
  app.get("/api/emojis", async (req, res) => {
    try {
      const allEmojis = await db.query.emojis.findMany({
        with: {
          category: true,
          createdBy: {
            columns: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });
      res.json(allEmojis);
    } catch (error) {
      console.error('Error fetching emojis:', error);
      res.status(500).json({ message: 'Failed to fetch emojis' });
    }
  });

  app.post("/api/emojis", upload.single('emoji'), async (req, res) => {
    try {
      const { shortcode, unicode, categoryId } = req.body;
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      if (!shortcode) {
        return res.status(400).json({ message: 'Shortcode is required' });
      }

      const [emoji] = await db.insert(emojis)
        .values({
          shortcode,
          unicode,
          imageUrl,
          categoryId: categoryId ? parseInt(categoryId) : null,
          isCustom: !!imageUrl,
          createdById: req.user?.id,
        })
        .returning();

      res.json(emoji);
    } catch (error) {
      console.error('Error creating emoji:', error);
      res.status(500).json({ message: 'Failed to create emoji' });
    }
  });

  // Enhanced Reaction Routes
  app.post("/api/messages/:messageId/reactions", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const { emojiId, emoji: legacyEmoji } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check for existing reaction
      const existingReaction = await db.query.reactions.findFirst({
        where: and(
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId),
          emojiId ? eq(reactions.emojiId, emojiId) : eq(reactions.emoji, legacyEmoji)
        ),
      });

      if (existingReaction) {
        return res.status(400).json({ message: 'Reaction already exists' });
      }

      // Create new reaction
      const [reaction] = await db.insert(reactions)
        .values({
          messageId,
          userId,
          emojiId,
          emoji: !emojiId ? legacyEmoji : null, // Support legacy emoji format
        })
        .returning();

      // Get the message to include channel info in broadcast
      const [message] = await db.query.messages.findMany({
        where: eq(messages.id, messageId),
        limit: 1,
      });

      // Broadcast reaction update
      wss.broadcast({
        type: 'reaction',
        payload: {
          ...reaction,
          channelId: message.channelId,
          threadParentId: message.threadParentId,
          user: req.user,
        },
      });

      res.json(reaction);
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ message: 'Failed to add reaction' });
    }
  });

  app.delete("/api/messages/:messageId/reactions/:reactionId", async (req, res) => {
    try {
      const messageId = parseInt(req.params.messageId);
      const reactionId = parseInt(req.params.reactionId);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const [deletedReaction] = await db.delete(reactions)
        .where(and(
          eq(reactions.id, reactionId),
          eq(reactions.messageId, messageId),
          eq(reactions.userId, userId)
        ))
        .returning();

      if (!deletedReaction) {
        return res.status(404).json({ message: 'Reaction not found' });
      }

      // Broadcast reaction removal
      wss.broadcast({
        type: 'reaction_removed',
        payload: {
          messageId,
          reactionId,
          userId,
        },
      });

      res.json({ message: 'Reaction removed successfully' });
    } catch (error) {
      console.error('Error removing reaction:', error);
      res.status(500).json({ message: 'Failed to remove reaction' });
    }
  });

  // Clean up WebSocket server on process exit
  process.on('SIGTERM', () => {
    wss.close();
    httpServer.close();
  });

  return httpServer;
}