import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage } from '@db/schema';
import React from 'react';

export function useChat() {
  const queryClient = useQueryClient();

  // Channels
  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
  });

  // Channel Messages
  const getChannelMessages = (channelId: number) => {
    return useQuery<Message[]>({
      queryKey: [`/api/channels/${channelId}/messages`],
      select: (messages) => messages.filter(m => !m.threadParentId), // Only show root messages
    });
  };

  // Thread Messages
  const getThreadMessages = (messageId: number) => {
    return useQuery<Message[]>({
      queryKey: [`/api/messages/${messageId}/thread`],
    });
  };

  // Direct Messages
  const getDirectMessages = (userId: number) => {
    return useQuery<DirectMessage[]>({
      queryKey: [`/api/dm/${userId}`],
    });
  };

  // Generate a temporary ID for optimistic updates
  const generateTempId = () => `temp-${Date.now()}`;

  // Send Message
  const sendMessage = useMutation({
    mutationFn: (message: { content: string; channelId: number; threadParentId?: number }) => {
      chatWs.send({
        type: 'message',
        payload: message
      });
      return Promise.resolve();
    },
    onMutate: async (newMessage) => {
      const tempId = generateTempId();

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: [`/api/channels/${newMessage.channelId}/messages`] 
      });

      if (newMessage.threadParentId) {
        await queryClient.cancelQueries({ 
          queryKey: [`/api/messages/${newMessage.threadParentId}/thread`] 
        });
      }

      // Create an optimistic message
      const optimisticMessage: Message = {
        id: tempId as any, // Temporary ID
        content: newMessage.content,
        channelId: newMessage.channelId,
        threadParentId: newMessage.threadParentId || null,
        userId: null, // Will be set by the server
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
      };

      if (newMessage.threadParentId) {
        // Update thread messages
        const previousThreadMessages = queryClient.getQueryData<Message[]>(
          [`/api/messages/${newMessage.threadParentId}/thread`]
        ) || [];

        queryClient.setQueryData<Message[]>(
          [`/api/messages/${newMessage.threadParentId}/thread`],
          [...previousThreadMessages, optimisticMessage]
        );
      } else {
        // Update channel messages
        const previousMessages = queryClient.getQueryData<Message[]>(
          [`/api/channels/${newMessage.channelId}/messages`]
        ) || [];

        queryClient.setQueryData<Message[]>(
          [`/api/channels/${newMessage.channelId}/messages`],
          [...previousMessages, optimisticMessage]
        );
      }

      return { optimisticMessage, tempId };
    },
    onSuccess: (_, variables, context) => {
      if (!context) return;

      // Clean up optimistic update on success
      const { tempId } = context;
      const queryKey = variables.threadParentId 
        ? [`/api/messages/${variables.threadParentId}/thread`]
        : [`/api/channels/${variables.channelId}/messages`];

      const messages = queryClient.getQueryData<Message[]>(queryKey) || [];
      queryClient.setQueryData<Message[]>(
        queryKey,
        messages.filter(m => m.id !== tempId)
      );
    }
  });

  // Add Reaction
  const addReaction = useMutation({
    mutationFn: (reaction: { messageId: number; emoji: string }) => {
      chatWs.send({
        type: 'reaction',
        payload: reaction
      });
      return Promise.resolve();
    },
  });

  // Delete Message
  const deleteMessage = useMutation({
    mutationFn: (messageId: number) => {
      chatWs.send({
        type: 'message_deleted',
        payload: { id: messageId }
      });
      return Promise.resolve();
    },
    onMutate: async (messageId) => {
      // Get all possible query keys that might contain this message
      const channelQueryKeys = channels?.map(c => [`/api/channels/${c.id}/messages`]) || [];
      const threadQueryKey = [`/api/messages/${messageId}/thread`];

      // Cancel any outgoing refetches
      await Promise.all([
        ...channelQueryKeys.map(key => queryClient.cancelQueries({ queryKey: key })),
        queryClient.cancelQueries({ queryKey: threadQueryKey })
      ]);

      // Update all relevant queries to remove the message
      channelQueryKeys.forEach(queryKey => {
        const messages = queryClient.getQueryData<Message[]>(queryKey) || [];
        queryClient.setQueryData<Message[]>(
          queryKey,
          messages.filter(m => m.id !== messageId)
        );
      });

      const threadMessages = queryClient.getQueryData<Message[]>(threadQueryKey) || [];
      queryClient.setQueryData<Message[]>(
        threadQueryKey,
        threadMessages.filter(m => m.id !== messageId)
      );
    },
  });

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    const unsubscribe = chatWs.subscribe((message) => {
      switch (message.type) {
        case 'channel_created':
        case 'channel_deleted':
          queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
          break;
        case 'message':
          const { channelId, threadParentId } = message.payload;

          if (threadParentId) {
            // Update thread messages
            const threadQueryKey = [`/api/messages/${threadParentId}/thread`];
            const currentThreadMessages = queryClient.getQueryData<Message[]>(threadQueryKey) || [];

            // Only add if not already present
            if (!currentThreadMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<Message[]>(
                threadQueryKey,
                currentThreadMessages.filter(m => !String(m.id).startsWith('temp-')).concat(message.payload)
              );
            }
          } else {
            // Update channel messages
            const channelQueryKey = [`/api/channels/${channelId}/messages`];
            const currentMessages = queryClient.getQueryData<Message[]>(channelQueryKey) || [];

            // Only add if not already present
            if (!currentMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<Message[]>(
                channelQueryKey,
                currentMessages.filter(m => !String(m.id).startsWith('temp-')).concat(message.payload)
              );
            }
          }
          break;
        case 'message_deleted':
          const messageId = message.payload.id;

          // Remove message from all possible locations
          channels?.forEach(channel => {
            const channelQueryKey = [`/api/channels/${channel.id}/messages`];
            const messages = queryClient.getQueryData<Message[]>(channelQueryKey) || [];

            queryClient.setQueryData<Message[]>(
              channelQueryKey,
              messages.filter(m => m.id !== messageId)
            );
          });

          // Also check thread messages
          const threadQueryKey = [`/api/messages/${messageId}/thread`];
          const threadMessages = queryClient.getQueryData<Message[]>(threadQueryKey) || [];

          queryClient.setQueryData<Message[]>(
            threadQueryKey,
            threadMessages.filter(m => m.id !== messageId)
          );
          break;
      }
    });

    return () => unsubscribe();
  }, [queryClient, channels]);

  return {
    channels,
    getChannelMessages,
    getThreadMessages,
    getDirectMessages,
    sendMessage,
    addReaction,
    deleteMessage,
  };
}