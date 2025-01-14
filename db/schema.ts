import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type InferModel } from "drizzle-orm";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  password: text("password").notNull(),
  status: text("status").default("active"),
  avatarUrl: text("avatar_url"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Channels table
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdById: integer("created_by_id").references(() => users.id),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").references(() => users.id),
  channelId: integer("channel_id").references(() => channels.id),
  threadParentId: integer("thread_parent_id").references(() => messages.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isDeleted: boolean("is_deleted").default(false),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  channels: many(channels, { relationName: "createdChannels" }),
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
  threadParent: one(messages, {
    fields: [messages.threadParentId],
    references: [messages.id],
  }),
  replies: many(messages, { relationName: "thread" }),
}));

// Enhanced schemas with additional validation
export const insertUserSchema = createInsertSchema(users).extend({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const selectUserSchema = createSelectSchema(users);
export const insertChannelSchema = createInsertSchema(channels);
export const selectChannelSchema = createSelectSchema(channels);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

// Type exports
export type User = InferModel<typeof users, "select">;
export type NewUser = InferModel<typeof users, "insert">;
export type Message = InferModel<typeof messages, "select">;
export type Channel = InferModel<typeof channels, "select">;

// Re-export the User type as SelectUser for auth compatibility
export type SelectUser = User;