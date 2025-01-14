import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage, User } from '@db/schema';
import React from 'react';

// Extend Message type to include user information
interface MessageWithUser extends Message {
  user?: User;
}

interface DirectMessageWithUser extends DirectMessage {
  fromUser?: User;
  toUser?: User;
}

export function useChat() {
  const queryClient = useQueryClient();

  // Channels
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
  });

  // Users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 30000, // Cache for 30 seconds
  });

  // Channel Messages
  const getChannelMessages = (channelId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/channels/${channelId}/messages`],
      select: (messages) => messages.filter(m => !m.threadParentId), // Only show root messages
      enabled: channelId > 0, // Only fetch when we have a valid channel ID
    });
  };

  // Thread Messages
  const getThreadMessages = (messageId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/messages/${messageId}/thread`],
      enabled: messageId > 0, // Only fetch when we have a valid message ID
      select: (messages) => messages.filter(m => !m.isDeleted), // Filter out deleted messages
    });
  };

  // Direct Messages
  const getDirectMessages = (userId: number) => {
    return useQuery<DirectMessageWithUser[]>({
      queryKey: [`/api/dm/${userId}`],
      enabled: userId > 0,
      select: (messages) => messages.filter(m => !m.isDeleted), // Filter out deleted messages
    });
  };

  // Generate a temporary ID for optimistic updates
  const generateTempId = () => -1 * Date.now(); // Use negative numbers for temp IDs

  // Send Message
  const sendMessage = useMutation({
    mutationFn: (message: { content: string; channelId: number; threadParentId?: number; userId?: number }) => {
      chatWs.send({
        type: 'message',
        payload: message
      });
      return Promise.resolve();
    },
    onMutate: async (newMessage) => {
      const tempId = generateTempId();

      await queryClient.cancelQueries({ 
        queryKey: [`/api/channels/${newMessage.channelId}/messages`] 
      });

      if (newMessage.threadParentId) {
        await queryClient.cancelQueries({ 
          queryKey: [`/api/messages/${newMessage.threadParentId}/thread`] 
        });
      }

      // Create an optimistic message
      const optimisticMessage: MessageWithUser = {
        id: tempId,
        content: newMessage.content,
        channelId: newMessage.channelId,
        threadParentId: newMessage.threadParentId || null,
        userId: newMessage.userId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      if (newMessage.threadParentId) {
        const previousThreadMessages = queryClient.getQueryData<MessageWithUser[]>(
          [`/api/messages/${newMessage.threadParentId}/thread`]
        ) || [];

        queryClient.setQueryData<MessageWithUser[]>(
          [`/api/messages/${newMessage.threadParentId}/thread`],
          [...previousThreadMessages, optimisticMessage]
        );
      } else {
        const previousMessages = queryClient.getQueryData<MessageWithUser[]>(
          [`/api/channels/${newMessage.channelId}/messages`]
        ) || [];

        queryClient.setQueryData<MessageWithUser[]>(
          [`/api/channels/${newMessage.channelId}/messages`],
          [...previousMessages, optimisticMessage]
        );
      }

      return { optimisticMessage, tempId };
    }
  });

  // Send Direct Message
  const sendDirectMessage = useMutation({
    mutationFn: (message: { content: string; toUserId: number; fromUserId: number }) => {
      chatWs.send({
        type: 'direct_message',
        payload: message
      });
      return Promise.resolve();
    },
    onMutate: async (newMessage) => {
      const queryKey = [`/api/dm/${newMessage.toUserId}`];
      await queryClient.cancelQueries({ queryKey });

      const optimisticMessage: DirectMessageWithUser = {
        id: generateTempId(),
        content: newMessage.content,
        fromUserId: newMessage.fromUserId,
        toUserId: newMessage.toUserId,
        createdAt: new Date(),
        isDeleted: false,
      };

      const previousMessages = queryClient.getQueryData<DirectMessageWithUser[]>(queryKey) || [];
      queryClient.setQueryData<DirectMessageWithUser[]>(
        queryKey,
        [...previousMessages, optimisticMessage]
      );

      return { optimisticMessage };
    }
  });

  // Delete Message
  const deleteMessage = useMutation({
    mutationFn: (messageId: number) => {
      chatWs.send({
        type: 'message_deleted',
        payload: { id: messageId }
      });
      return Promise.resolve(messageId);
    }
  });

  // Delete Direct Message
  const deleteDirectMessage = useMutation({
    mutationFn: (messageId: number) => {
      chatWs.send({
        type: 'direct_message_deleted',
        payload: { id: messageId }
      });
      return Promise.resolve(messageId);
    }
  });

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    const unsubscribe = chatWs.subscribe((message) => {
      switch (message.type) {
        case 'channel_created':
        case 'channel_deleted':
          queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
          break;
        case 'message': {
          const { channelId, threadParentId } = message.payload;

          if (threadParentId) {
            queryClient.invalidateQueries({ 
              queryKey: [`/api/messages/${threadParentId}/thread`] 
            });
          } else {
            queryClient.invalidateQueries({ 
              queryKey: [`/api/channels/${channelId}/messages`] 
            });
          }
          break;
        }
        case 'direct_message': {
          const { fromUserId, toUserId } = message.payload;
          // Invalidate queries for both users involved
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
          break;
        }
        case 'message_deleted':
        case 'direct_message_deleted': {
          const { fromUserId, toUserId } = message.payload;
          if (fromUserId && toUserId) {
            // DM deletion
            queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
          } else {
            // Channel message deletion
            const { channelId } = message.payload;
            queryClient.invalidateQueries({ 
              queryKey: [`/api/channels/${channelId}/messages`] 
            });
          }
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  return {
    channels,
    users,
    getChannelMessages,
    getThreadMessages,
    getDirectMessages,
    sendMessage,
    sendDirectMessage,
    deleteMessage,
    deleteDirectMessage,
  };
}