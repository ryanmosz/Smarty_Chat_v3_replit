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
        id: Date.now(), // Temporary ID
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

      return { optimisticMessage };
    },
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
  });

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    const unsubscribe = chatWs.subscribe((message) => {
      switch (message.type) {
        case 'channel_created':
        case 'channel_deleted':
          // Invalidate channels query to trigger a refetch
          queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
          break;
        case 'message':
          const { channelId, threadParentId } = message.payload;

          if (threadParentId) {
            // Update thread messages
            const threadQueryKey = [`/api/messages/${threadParentId}/thread`];
            const currentThreadMessages = queryClient.getQueryData<Message[]>(threadQueryKey) || [];

            if (!currentThreadMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<Message[]>(
                threadQueryKey,
                [...currentThreadMessages, message.payload]
              );
            }
          } else {
            // Update channel messages
            const channelQueryKey = [`/api/channels/${channelId}/messages`];
            const currentMessages = queryClient.getQueryData<Message[]>(channelQueryKey) || [];

            if (!currentMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<Message[]>(
                channelQueryKey,
                [...currentMessages, message.payload]
              );
            }
          }
          break;
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

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