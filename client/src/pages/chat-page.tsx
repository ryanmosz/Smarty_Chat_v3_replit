import { useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChannelList } from "@/components/chat/channel-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ThreadPanel } from "@/components/chat/thread-panel";
import { ChatHeader } from "@/components/chat/chat-header";
import type { Message } from "@db/schema";

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<number>();
  const [threadMessage, setThreadMessage] = useState<Message>();
  const { channels = [], getChannelMessages, getThreadMessages } = useChat();
  const { data: channelMessages = [] } = getChannelMessages(selectedChannelId || 0);
  const { data: threadMessages = [] } = threadMessage 
    ? getThreadMessages(threadMessage.id)
    : { data: undefined };

  const displayMessages = threadMessage ? threadMessages : channelMessages;

  return (
    <div className="h-screen flex">
      {/* Channel List Sidebar - Full Height */}
      <div className="w-60 border-r bg-background">
        <ChannelList
          channels={channels}
          selectedChannelId={selectedChannelId}
          onChannelSelect={setSelectedChannelId}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader />
        {/* Chat Area */}
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            {selectedChannelId ? (
              <>
                <MessageList
                  messages={displayMessages}
                  onThreadClick={setThreadMessage}
                />
                <MessageInput 
                  channelId={selectedChannelId} 
                  threadParentId={threadMessage?.id}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a channel to start chatting
              </div>
            )}
          </div>

          {threadMessage && (
            <ThreadPanel
              parentMessage={threadMessage}
              onClose={() => setThreadMessage(undefined)}
            />
          )}
        </div>
      </div>
    </div>
  );
}