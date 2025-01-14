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
    select: (data) => {
      if (!data) return [];
      const activeMessages = data.filter(m => !m.isDeleted);
      const uniqueUsers = new Set<string>();
      return activeMessages.filter(msg => {
        if (!msg.fromUser?.id || !msg.toUser?.id) return false;
        const key = `${Math.min(msg.fromUser.id, msg.toUser.id)}-${Math.max(msg.fromUser.id, msg.toUser.id)}`;
        if (!uniqueUsers.has(key)) {
          uniqueUsers.add(key);
          return true;
        }
        return false;
      });
    },
  });

  // Channel Messages
  const getChannelMessages = (channelId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/channels/${channelId}/messages`],
      select: (messages) => messages?.filter(m => !m.threadParentId && !m.isDeleted) || [],
      enabled: channelId > 0,
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

  // Direct Messages
  const getDirectMessages = (userId: number) => {
    return useQuery<DirectMessageWithUser[]>({
      queryKey: [`/api/dm/${userId}`],
      enabled: userId > 0,
      select: (messages) => messages?.filter(m => !m.isDeleted) || [],
    });
  };

  // Generate a temporary ID for optimistic updates
  const generateTempId = () => -1 * Date.now();

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
      await queryClient.cancelQueries({ queryKey: [`/api/channels/${newMessage.channelId}/messages`] });
      if (newMessage.threadParentId) {
        await queryClient.cancelQueries({ queryKey: [`/api/messages/${newMessage.threadParentId}/thread`] });
      }
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

  // Add Reaction - Updated with improved error handling and optimistic updates
  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: number; emoji: string }) => {
      console.log('Sending reaction request:', { messageId, emoji }); // Debug log

      const response = await fetch(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reaction API error:', errorText); // Debug log
        throw new Error(errorText || 'Failed to add reaction');
      }

      const data = await response.json();
      console.log('Reaction API response:', data); // Debug log
      return data;
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/messages/${variables.messageId}`] });

      // Return context with the optimistic value
      return { messageId: variables.messageId };
    },
    onError: (err, variables, context) => {
      console.error('Error adding reaction:', err);
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context) {
        queryClient.invalidateQueries({ queryKey: [`/api/messages/${context.messageId}`] });
      }
    },
    onSuccess: (data, variables) => {
      console.log('Reaction added successfully:', data); // Debug log

      // Update both channel messages and thread messages
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
      switch (message.type) {
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
        case 'direct_message': {
          const { fromUserId, toUserId } = message.payload;
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
          queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
          queryClient.invalidateQueries({ queryKey: ['/api/active-conversations'] });
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
        case 'reaction': {
          const { messageId, channelId, threadParentId } = message.payload;
          if (threadParentId) {
            // Update thread messages
            queryClient.invalidateQueries({ queryKey: [`/api/messages/${threadParentId}/thread`] });
          }
          if (channelId) {
            // Update channel messages
            queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
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