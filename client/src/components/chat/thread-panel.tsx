import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@db/schema";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { useChat } from "@/hooks/use-chat";
import { format } from "date-fns";

// Extend Message type to include user relation from use-chat.ts
type MessageWithUser = Message & {
  user?: {
    username: string;
    avatarColor?: string | null;
  } | null;
};

interface ThreadPanelProps {
  parentMessage: MessageWithUser;
  onClose: () => void;
}

export function ThreadPanel({ parentMessage, onClose }: ThreadPanelProps) {
  const { getThreadMessages } = useChat();
  const { data: threadMessages = [] } = getThreadMessages(parentMessage.id);

  return (
    <div className="w-80 border-l bg-background flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Thread</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 border-b bg-accent/50">
          <div className="flex items-start gap-3">
            <Avatar 
              className="h-8 w-8 mt-1"
              style={{ 
                backgroundColor: parentMessage.user?.avatarColor || 'hsl(0, 0%, 90%)'
              }}
            >
              <AvatarFallback
                style={{ 
                  backgroundColor: parentMessage.user?.avatarColor || 'hsl(0, 0%, 90%)',
                  color: 'black'
                }}
              >
                {parentMessage.user?.username.slice(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {parentMessage.user?.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {parentMessage.createdAt && format(new Date(parentMessage.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <div className="mt-1">{parentMessage.content}</div>
            </div>
          </div>
        </div>
        <MessageList messages={threadMessages} />
      </ScrollArea>
      <MessageInput 
        channelId={parentMessage.channelId!} 
        threadParentId={parentMessage.id} 
      />
    </div>
  );
}