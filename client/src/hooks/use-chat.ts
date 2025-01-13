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
        type: 'delete_message',
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
          // Invalidate messages for the specific channel
          queryClient.invalidateQueries({ 
            queryKey: [`/api/channels/${message.payload.channelId}/messages`] 
          });
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