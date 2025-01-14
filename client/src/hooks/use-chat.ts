import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatWs } from '../lib/websocket';
import type { Channel, Message, DirectMessage, User, Reaction } from '@db/schema';
import React from 'react';

interface MessageWithUser extends Message {
  user?: User | null;
  reactions?: (Reaction & { user?: User | null })[];
}

interface DirectMessageWithUser extends DirectMessage {
  fromUser?: User | null;
  toUser?: User | null;
}

export function useChat() {
  const queryClient = useQueryClient();

  // Channels
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels'],
    staleTime: 0
  });

  // Users - reduced stale time to ensure fresh data
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 0
  });

  // Active DM Users with real-time status updates
  const { data: activeConversations = [] } = useQuery<DirectMessageWithUser[]>({
    queryKey: ['/api/active-conversations'],
    staleTime: 0,
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
      staleTime: 0
    });
  };

  // Thread Messages
  const getThreadMessages = (messageId: number) => {
    return useQuery<MessageWithUser[]>({
      queryKey: [`/api/messages/${messageId}/thread`],
      enabled: messageId > 0,
      select: (messages) => messages?.filter(m => !m.isDeleted) || [],
      staleTime: 0
    });
  };

  // Direct Messages
  const getDirectMessages = (userId: number) => {
    return useQuery<DirectMessageWithUser[]>({
      queryKey: [`/api/dm/${userId}`],
      enabled: userId > 0,
      select: (messages) => messages?.filter(m => !m.isDeleted) || [],
      staleTime: 0
    });
  };

  // Send Message
  const sendMessage = useMutation({
    mutationFn: async (message: { content: string; channelId: number; threadParentId?: number; userId?: number }) => {
      chatWs.send({
        type: 'message',
        payload: message
      });
    }
  });

  // Send Direct Message
  const sendDirectMessage = useMutation({
    mutationFn: async (message: { content: string; toUserId: number; fromUserId: number }) => {
      chatWs.send({
        type: 'direct_message',
        payload: message
      });
    }
  });

  // Subscribe to WebSocket updates
  React.useEffect(() => {
    const unsubscribe = chatWs.subscribe((message) => {
      try {
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

          case 'direct_message': {
            const { fromUserId, toUserId } = message.payload;
            if (fromUserId) {
              queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
            }
            if (toUserId) {
              queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
            }
            queryClient.invalidateQueries({ queryKey: ['/api/active-conversations'] });
            break;
          }

          case 'message_deleted':
          case 'direct_message_deleted': {
            const { fromUserId, toUserId, channelId, threadParentId } = message.payload;
            if (fromUserId && toUserId) {
              queryClient.invalidateQueries({ queryKey: [`/api/dm/${fromUserId}`] });
              queryClient.invalidateQueries({ queryKey: [`/api/dm/${toUserId}`] });
              queryClient.invalidateQueries({ queryKey: ['/api/active-conversations'] });
            } else if (channelId) {
              if (threadParentId) {
                queryClient.invalidateQueries({ queryKey: [`/api/messages/${threadParentId}/thread`] });
              } else {
                queryClient.invalidateQueries({ queryKey: [`/api/channels/${channelId}/messages`] });
              }
            }
            break;
          }

          case 'reaction':
          case 'reaction_deleted': {
            const { messageId, threadParentId, channelId } = message.payload;
            if (threadParentId) {
              queryClient.invalidateQueries({ queryKey: [`/api/messages/${threadParentId}/thread`] });
            } else if (channelId) {
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
          }
          break;
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
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
  };
}