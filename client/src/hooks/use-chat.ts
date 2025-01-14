import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage, User } from '@db/schema';
import React from 'react';

// Extend Message type to include user information
interface MessageWithUser extends Message {
  user?: User;
}

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
    return useQuery<DirectMessage[]>({
      queryKey: [`/api/dm/${userId}`],
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
        messages.filter(m => m.id !== tempId)
      );
    }
  });

  // Delete Message
  const deleteMessage = useMutation({
    mutationFn: (messageId: number) => {
      return new Promise((resolve, reject) => {
        try {
          chatWs.send({
            type: 'message_deleted',
            payload: { id: messageId }
          });
          resolve(messageId);
        } catch (error) {
          reject(error);
        }
      });
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
            const threadQueryKey = [`/api/messages/${threadParentId}/thread`];
            const currentThreadMessages = queryClient.getQueryData<MessageWithUser[]>(threadQueryKey) || [];

            if (!currentThreadMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<MessageWithUser[]>(
                threadQueryKey,
                currentThreadMessages.filter(m => typeof m.id === 'number' && m.id < 0).concat(message.payload)
              );
            }
          } else {
            const msgChannelQueryKey = [`/api/channels/${channelId}/messages`];
            const currentMessages = queryClient.getQueryData<MessageWithUser[]>(msgChannelQueryKey) || [];

            if (!currentMessages.some(m => m.id === message.payload.id)) {
              queryClient.setQueryData<MessageWithUser[]>(
                msgChannelQueryKey,
                currentMessages.filter(m => typeof m.id === 'number' && m.id < 0).concat(message.payload)
              );
            }
          }
          break;
        }
        case 'message_deleted': {
          const { id: deletedMessageId, channelId: deletedChannelId } = message.payload;

          // Update channel messages
          const channelMessagesKey = [`/api/channels/${deletedChannelId}/messages`];
          const channelMessages = queryClient.getQueryData<MessageWithUser[]>(channelMessagesKey) || [];
          queryClient.setQueryData<MessageWithUser[]>(
            channelMessagesKey,
            channelMessages.filter(m => m.id !== deletedMessageId)
          );

          // Update thread messages
          const threadMessagesKey = [`/api/messages/${deletedMessageId}/thread`];
          const threadMessages = queryClient.getQueryData<MessageWithUser[]>(threadMessagesKey) || [];
          queryClient.setQueryData<MessageWithUser[]>(
            threadMessagesKey,
            threadMessages.filter(m => m.id !== deletedMessageId)
          );
          break;
        }
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
    deleteMessage,
  };
}