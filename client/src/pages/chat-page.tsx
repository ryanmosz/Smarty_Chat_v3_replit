import { useState, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChannelList } from "@/components/chat/channel-list";
import { DirectMessageList } from "@/components/chat/direct-message-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ChatHeader } from "@/components/chat/chat-header";
import type { Message, DirectMessage } from "@db/schema";

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<number>();
  const [selectedUserId, setSelectedUserId] = useState<number>();
  const [threadMessage, setThreadMessage] = useState<Message>();
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
      {/* Sidebar - Full Height */}
      <div className="w-60 border-r bg-background flex flex-col">
        <ChannelList
          channels={channels}
          selectedChannelId={selectedChannelId}
          onChannelSelect={setSelectedChannelId}
        />
        <DirectMessageList
          users={users}
          selectedUserId={selectedUserId}
          onUserSelect={setSelectedUserId}
        />
      </div>

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