import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage, User } from '@db/schema';
import React from 'react';

// Extend Message type to include user relation
type MessageWithUser = Message & {
  user?: User | null;
};

export function useChat() {
  const queryClient = useQueryClient();

  // Channels
  const { data: channels } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
  });

  // Channel Messages
  const getChannelMessages = (channelId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/channels/${channelId}/messages`],
      select: (messages) => messages.filter(m => !m.threadParentId), // Only show root messages
    });
  };

  // Thread Messages
  const getThreadMessages = (messageId: number) => {
    return useQuery<MessageWithUser[]>({
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

      await queryClient.cancelQueries({ 
        queryKey: [`/api/channels/${newMessage.channelId}/messages`] 
      });

      if (newMessage.threadParentId) {
        await queryClient.cancelQueries({ 
          queryKey: [`/api/messages/${newMessage.threadParentId}/thread`] 
        });
      }

      // Create an optimistic message with user data
      const optimisticMessage: MessageWithUser = {
        id: tempId as unknown as number,
        content: newMessage.content,
        channelId: newMessage.channelId,
        threadParentId: newMessage.threadParentId || null,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDeleted: false,
        user: null,
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
    },
    onSuccess: (_, variables, context) => {
      if (!context) return;

      const { tempId } = context;
      const queryKey = variables.threadParentId 
        ? [`/api/messages/${variables.threadParentId}/thread`]
        : [`/api/channels/${variables.channelId}/messages`];

      const messages = queryClient.getQueryData<MessageWithUser[]>(queryKey) || [];
      queryClient.setQueryData<MessageWithUser[]>(
        queryKey,
        messages.filter(m => String(m.id) !== tempId)
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
      const channelQueryKeys = channels?.map(c => [`/api/channels/${c.id}/messages`]) || [];
      const threadQueryKey = [`/api/messages/${messageId}/thread`];

      await Promise.all([
        ...channelQueryKeys.map(key => queryClient.cancelQueries({ queryKey: key })),
        queryClient.cancelQueries({ queryKey: threadQueryKey })
      ]);

      channelQueryKeys.forEach(queryKey => {
        const messages = queryClient.getQueryData<MessageWithUser[]>(queryKey) || [];
        queryClient.setQueryData<MessageWithUser[]>(
          queryKey,
          messages.filter(m => m.id !== messageId)
        );
      });

      const threadMessages = queryClient.getQueryData<MessageWithUser[]>(threadQueryKey) || [];
      queryClient.setQueryData<MessageWithUser[]>(
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
            const threadQueryKey = [`/api/messages/${threadParentId}/thread`];
            const currentThreadMessages = queryClient.getQueryData<MessageWithUser[]>(threadQueryKey) || [];

            if (!currentThreadMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<MessageWithUser[]>(
                threadQueryKey,
                currentThreadMessages.filter(m => !String(m.id).startsWith('temp-')).concat(message.payload)
              );
            }
          } else {
            const channelQueryKey = [`/api/channels/${channelId}/messages`];
            const currentMessages = queryClient.getQueryData<MessageWithUser[]>(channelQueryKey) || [];

            if (!currentMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<MessageWithUser[]>(
                channelQueryKey,
                currentMessages.filter(m => !String(m.id).startsWith('temp-')).concat(message.payload)
              );
            }
          }
          break;
        case 'message_deleted':
          const messageId = message.payload.id;

          channels?.forEach(channel => {
            const channelQueryKey = [`/api/channels/${channel.id}/messages`];
            const messages = queryClient.getQueryData<MessageWithUser[]>(channelQueryKey) || [];

            queryClient.setQueryData<MessageWithUser[]>(
              channelQueryKey,
              messages.filter(m => m.id !== messageId)
            );
          });

          const threadQueryKey = [`/api/messages/${messageId}/thread`];
          const threadMessages = queryClient.getQueryData<MessageWithUser[]>(threadQueryKey) || [];

          queryClient.setQueryData<MessageWithUser[]>(
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