import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  status: text("status").default("offline").notNull(),
  customStatus: text("custom_status").default("online"),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  usernameSearchIdx: index("username_search_idx").on(table.username),
}));

// Color tracking table
export const colorAssignments = pgTable("color_assignments", {
  id: serial("id").primaryKey(),
  color: text("color").notNull(),
  lastUsed: timestamp("last_used").defaultNow().notNull(),
});

// Channels table
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
}, (table) => ({
  nameSearchIdx: index("channel_name_search_idx").on(table.name),
}));

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id),
  channelId: integer("channel_id").references(() => channels.id),
  threadParentId: integer("thread_parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
}, (table) => ({
  contentSearchIdx: index("message_content_search_idx").on(table.content),
}));

// Direct Messages table
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
}, (table) => ({
  contentSearchIdx: index("dm_content_search_idx").on(table.content),
}));

// Message Reactions table
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  userId: integer("user_id").references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  sentDirectMessages: many(directMessages, { relationName: "fromUser" }),
  receivedDirectMessages: many(directMessages, { relationName: "toUser" }),
}));

export const channelRelations = relations(channels, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [channels.createdById],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messageRelations = relations(messages, ({ one, many }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  thread: one(messages, {
    fields: [messages.threadParentId],
    references: [messages.id],
  }),
  replies: many(messages, { relationName: "thread" }),
  reactions: many(reactions),
}));

export const directMessageRelations = relations(directMessages, ({ one }) => ({
  fromUser: one(users, {
    fields: [directMessages.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [directMessages.toUserId],
    references: [users.id],
  }),
}));

export const reactionRelations = relations(reactions, ({ one }) => ({
  user: one(users, {
    fields: [reactions.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id],
  }),
}));

// Re-export schemas and types
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertChannelSchema = createInsertSchema(channels);
export const selectChannelSchema = createSelectSchema(channels);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export const insertDirectMessageSchema = createInsertSchema(directMessages);
export const selectDirectMessageSchema = createSelectSchema(directMessages);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;

// Re-export the User type as SelectUser for auth compatibility
export type SelectUser = User;