import { useState, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChannelList } from "@/components/chat/channel-list";
import { DirectMessageList } from "@/components/chat/direct-message-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ChatHeader } from "@/components/chat/chat-header";
import type { Message, User } from "@db/schema";
import { useLocation } from "wouter";

interface MessageWithUser extends Message {
  user?: User;
}

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<number>();
  const [selectedUserId, setSelectedUserId] = useState<number>();
  const [threadMessage, setThreadMessage] = useState<MessageWithUser>();
  const [showChannels, setShowChannels] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number>();
  const [location] = useLocation();

  const { 
    channels = [], 
    users = [], 
    getChannelMessages, 
    getDirectMessages,
    getThreadMessages 
  } = useChat();

  const { data: channelMessages = [] } = getChannelMessages(selectedChannelId || 0);
  const { data: directMessages = [] } = getDirectMessages(selectedUserId || 0);
  const { data: threadMessages = [] } = getThreadMessages(threadMessage?.id || 0);

  // Listen for user selection from search
  useEffect(() => {
    const handleUserSelect = (e: Event) => {
      const event = e as CustomEvent<number>;
      setSelectedChannelId(undefined); // Clear channel selection when switching to DM
      setSelectedUserId(event.detail);
    };

    window.addEventListener('selectUser', handleUserSelect);
    return () => {
      window.removeEventListener('selectUser', handleUserSelect);
    };
  }, []);

  // Extract channel ID and message ID from URL
  useEffect(() => {
    const channelMatch = location.match(/\/channel\/(\d+)/);
    if (channelMatch) {
      const channelId = parseInt(channelMatch[1], 10);
      setSelectedUserId(undefined); // Clear user selection when switching to channel
      setSelectedChannelId(channelId);

      // Parse message ID from query params
      const searchParams = new URLSearchParams(window.location.search);
      const messageId = searchParams.get('message');
      if (messageId) {
        setHighlightedMessageId(parseInt(messageId, 10));
      } else {
        setHighlightedMessageId(undefined);
      }
    }
  }, [location]);

  // Reset highlighted message when changing channels
  useEffect(() => {
    setHighlightedMessageId(undefined);
  }, [selectedChannelId, selectedUserId]);

  // Reset thread view when changing channels or DMs
  useEffect(() => {
    setThreadMessage(undefined);
  }, [selectedChannelId, selectedUserId]);

  // Reset other selection when one is chosen
  useEffect(() => {
    if (selectedChannelId) setSelectedUserId(undefined);
  }, [selectedChannelId]);

  useEffect(() => {
    if (selectedUserId) setSelectedChannelId(undefined);
  }, [selectedUserId]);

  const messages = directMessages.map(dm => ({
    id: dm.id,
    content: dm.content,
    createdAt: dm.createdAt,
    updatedAt: dm.createdAt,
    isDeleted: dm.isDeleted,
    userId: dm.fromUserId,
    channelId: null,
    threadParentId: null,
    user: dm.fromUser
  }));

  return (
    <div className="h-screen flex">
      {/* Unified Sidebar */}
      <aside className="w-60 flex flex-col bg-background">
        <div className="relative flex flex-col">
          <ChannelList
            channels={channels}
            selectedChannelId={selectedChannelId}
            onChannelSelect={setSelectedChannelId}
            onShowChannelsChange={setShowChannels}
          />
          <div className={`transition-all duration-200 ${showChannels ? 'mt-0' : '-mt-2'}`}>
            <DirectMessageList
              users={users}
              selectedUserId={selectedUserId}
              onUserSelect={setSelectedUserId}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />
        {/* Chat Area */}
        <div className="flex-1 flex">
          {/* Main Message Area */}
          <div className="flex-1 flex flex-col">
            {selectedChannelId ? (
              <>
                {threadMessage ? (
                  <div className="flex-1 flex flex-col">
                    <div className="px-4 py-2 border-b bg-accent/20">
                      <button 
                        onClick={() => setThreadMessage(undefined)}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        ← Back to channel
                      </button>
                      <div className="mt-2 font-semibold">Thread</div>
                    </div>
                    <MessageList
                      messages={[threadMessage, ...threadMessages]}
                      onThreadClick={undefined}
                      highlightedMessageId={highlightedMessageId}
                    />
                    <MessageInput 
                      channelId={selectedChannelId} 
                      threadParentId={threadMessage?.id}
                    />
                  </div>
                ) : (
                  <>
                    <MessageList
                      messages={channelMessages}
                      onThreadClick={setThreadMessage}
                      highlightedMessageId={highlightedMessageId}
                    />
                    <MessageInput 
                      channelId={selectedChannelId}
                    />
                  </>
                )}
              </>
            ) : selectedUserId ? (
              <>
                <MessageList
                  messages={messages}
                  onThreadClick={undefined}
                  highlightedMessageId={highlightedMessageId}
                />
                <MessageInput 
                  toUserId={selectedUserId}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a channel or user to start chatting
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}