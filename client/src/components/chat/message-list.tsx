import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message } from "@db/schema";
import { useChat } from "@/hooks/use-chat";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";

interface MessageListProps {
  messages: Message[];
  onThreadClick?: (message: Message) => void;
}

export function MessageList({ messages, onThreadClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deleteMessage } = useChat();
  const { user } = useUser();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDelete = async (messageId: number) => {
    await deleteMessage.mutateAsync(messageId);
  };

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex items-start gap-3 group">
            <Avatar 
              className="h-8 w-8 mt-1"
              style={{ 
                backgroundColor: message.user?.avatarColor || 'hsl(0, 0%, 90%)'
              }}
            >
              <AvatarFallback
                style={{ 
                  backgroundColor: message.user?.avatarColor || 'hsl(0, 0%, 90%)',
                  color: 'black'
                }}
              >
                {message.user?.username.slice(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {message.user?.username}
                </span>
                <span className="text-xs text-muted-foreground">
                  {message.createdAt && format(new Date(message.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <div className="mt-1">{message.content}</div>
              <div className="mt-2 flex items-center gap-2">
                {onThreadClick && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => onThreadClick(message)}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Thread
                  </Button>
                )}
                {/* Only show delete button if user authored the message */}
                {user?.id === message.userId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => handleDelete(message.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}