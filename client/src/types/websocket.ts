export type WebSocketMessage = {
  type: 'message' | 'typing' | 'channel_created' | 'channel_deleted' | 'reaction' | 'error';
  payload: any;
};