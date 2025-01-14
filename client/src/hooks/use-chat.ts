import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage, User, Reaction } from '@db/schema';
import React from 'react';

interface MessageWithUser extends Message {
  user?: User;
  reactions?: (Reaction & {
    user: User;
  })[];
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

  // Users - reduced stale time to ensure fresh data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 0, // Always fetch fresh data
  });

  // Active DM Users with real-time status updates
  const { data: activeConversations = [] } = useQuery<DirectMessageWithUser[]>({
    queryKey: ['/api/active-conversations'],
    staleTime: 0, // Always fetch fresh data
  });

  // Channel Messages
  const getChannelMessages = (channelId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/channels/${channelId}/messages`],
      select: (messages) => messages?.filter(m => !m.threadParentId && !m.isDeleted) || [],
      enabled: channelId > 0,
    });
  };

  // Direct Messages
  const getDirectMessages = (userId: number) => {
    return useQuery<DirectMessageWithUser[]>({
      queryKey: [`/api/dm/${userId}`],
      enabled: userId > 0,
      select: (messages) => messages?.filter(m => !m.isDeleted) || [],
    });
  };

  // Thread Messages
  const getThreadMessages = (messageId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/messages/${messageId}/thread`],
      enabled: messageId > 0,
      select: (messages) => messages?.filter(m => !m.isDeleted) || [],
    });
  };

  // Send Message
  const sendMessage = useMutation({
    mutationFn: (message: { content: string; channelId: number; threadParentId?: number; userId?: number }) => {
      console.log('Sending channel message:', message);
      chatWs.send({
        type: 'message',
        payload: message
      });
      return Promise.resolve();
    },
    onMutate: async (newMessage) => {
      const queryKey = [`/api/channels/${newMessage.channelId}/messages`];
      await queryClient.cancelQueries({ queryKey });
      if (newMessage.threadParentId) {
        await queryClient.cancelQueries({ 
          queryKey: [`/api/messages/${newMessage.threadParentId}/thread`] 
        });
      }

      const optimisticMessage: MessageWithUser = {
        id: -1 * Date.now(),
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
        const previousMessages = queryClient.getQueryData<MessageWithUser[]>(queryKey) || [];
        queryClient.setQueryData<MessageWithUser[]>(
          queryKey,
          [...previousMessages, optimisticMessage]
        );
      }

      return { optimisticMessage };
    }
  });

  // Send Direct Message
  const sendDirectMessage = useMutation({
    mutationFn: (message: { content: string; toUserId: number; fromUserId: number }) => {
      console.log('Sending direct message:', message);
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
        id: -1 * Date.now(),
        content: newMessage.content,
        fromUserId: newMessage.fromUserId,
        toUserId: newMessage.toUserId,
        createdAt: new Date(),
        isDeleted: false,
        fromUser: users.find(u => u.id === newMessage.fromUserId),
        toUser: users.find(u => u.id === newMessage.toUserId),
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

  // Add Reaction - Updated with improved error handling and optimistic updates
  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
        credentials: 'include', // Important for auth
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to add reaction');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate both channel messages and thread messages
      if (data.channelId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/channels/${data.channelId}/messages`],
        });
      }
      if (data.threadParentId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/messages/${data.threadParentId}/thread`],
        });
      }
    },
  });

  // Remove Reaction - Updated with optimistic updates
  const removeReaction = useMutation({
    mutationFn: async ({ messageId, reactionId }: { messageId: number; reactionId: number }) => {
      const response = await fetch(`/api/messages/${messageId}/reactions/${reactionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove reaction');
      }
    },
    onSuccess: (_, variables) => {
      // Optimistically update the UI
      const { messageId } = variables;

      queryClient.invalidateQueries({ 
        queryKey: [`/api/messages/${messageId}`],
        exact: true,
      });
    },
  });

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    const unsubscribe = chatWs.subscribe((message) => {
      console.log('Received WebSocket message:', message);

      switch (message.type) {
        case 'direct_message': {
          const { fromUserId, toUserId } = message.payload;
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
          queryClient.invalidateQueries({ queryKey: ['/api/active-conversations'] });
          break;
        }
        case 'user_status': {
          const { userId, status } = message.payload;
          queryClient.setQueryData<User[]>(['/api/users'], (oldUsers) => {
            if (!oldUsers) return oldUsers;
            return oldUsers.map(user =>
              user.id === userId
                ? { ...user, status, customStatus: status }
                : user
            );
          });
          queryClient.invalidateQueries({ 
            queryKey: ['/api/active-conversations'],
            refetchType: 'active'
          });
          break;
        }
        case 'channel_created':
        case 'channel_deleted':
          queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
          break;
        case 'message': {
          const { channelId, threadParentId } = message.payload;
          if (threadParentId) {
            queryClient.invalidateQueries({ queryKey: [`/api/messages/${threadParentId}/thread`] });
          } else {
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
          }
          break;
        }
        case 'reaction_update': {
          const { channelId, threadParentId } = message.payload;
          if (channelId) {
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
          }
          if (threadParentId) {
            queryClient.invalidateQueries({ queryKey: [`/api/messages/${threadParentId}/thread`] });
          }
          break;
        }
        case 'message_deleted':
        case 'direct_message_deleted': {
          const { fromUserId, toUserId } = message.payload;
          if (fromUserId && toUserId) {
            queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
            queryClient.invalidateQueries({ queryKey: ['/api/active-conversations'] });
          } else {
            const { channelId } = message.payload;
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
          }
          break;
        }
        case 'reaction': {
          const { channelId, threadParentId } = message.payload;
          // Invalidate both channel and thread queries
          if (channelId) {
            queryClient.invalidateQueries({ 
              queryKey: [`/api/channels/${channelId}/messages`],
            });
          }
          if (threadParentId) {
            queryClient.invalidateQueries({ 
              queryKey: [`/api/messages/${threadParentId}/thread`],
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
    activeConversations,
    getChannelMessages,
    getThreadMessages,
    getDirectMessages,
    sendMessage,
    sendDirectMessage,
    deleteMessage,
    deleteDirectMessage,
    addReaction,
    removeReaction,
  };
}