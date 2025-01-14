export type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'message_deleted' | 
        'direct_message' | 'direct_message_deleted' | 'reaction' | 'error' | 'user_status';
  payload: any;
};