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
  const { data: threadMessages = [] } = getThreadMessages(threadMessage?.id || 0);

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
          {/* Main Message Area */}
          <div className="flex-1 flex flex-col">
            {selectedChannelId ? (
              <>
                {threadMessage ? (
                  <>
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
                  </>
                ) : (
                  <MessageList
                    messages={channelMessages}
                    onThreadClick={setThreadMessage}
                  />
                )}
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

          {/* Keep the thread panel for context */}
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