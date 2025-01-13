import { useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { UserHeader } from "@/components/chat/user-header";
import { SearchBar } from "@/components/chat/search-bar";
import { ChannelList } from "@/components/chat/channel-list";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ThreadPanel } from "@/components/chat/thread-panel";
import type { Message } from "@db/schema";

export default function ChatPage() {
  const [selectedChannelId, setSelectedChannelId] = useState<number>();
  const [threadMessage, setThreadMessage] = useState<Message>();
  const { channels = [], getChannelMessages } = useChat();
  const { user } = useUser();

  const { data: messages = [] } = getChannelMessages(selectedChannelId || 0);

  if (!user) return null;

  return (
    <div className="h-screen flex">
      <div className="flex flex-col">
        <UserHeader />
        <SearchBar />
        <ChannelList
          channels={channels}
          selectedChannelId={selectedChannelId}
          onChannelSelect={setSelectedChannelId}
        />
      </div>
      
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col">
            {selectedChannelId ? (
              <>
                <MessageList
                  messages={messages}
                  users={[user]} // TODO: Fetch all users
                  onThreadClick={setThreadMessage}
                />
                <MessageInput channelId={selectedChannelId} />
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
              users={[user]} // TODO: Fetch all users
              onClose={() => setThreadMessage(undefined)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
