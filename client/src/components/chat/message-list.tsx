import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message, User } from "@db/schema";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";

interface MessageWithUser extends Message {
  user?: User;
}

interface MessageListProps {
  messages: MessageWithUser[];
  onThreadClick?: (message: MessageWithUser) => void;
  highlightedMessageId?: number;
}

export function MessageList({ messages, onThreadClick, highlightedMessageId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Scroll to highlighted message when it changes
  useEffect(() => {
    if (highlightedMessageId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessageId]);

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          const username = message.user?.username || 'Unknown';
          const avatarColor = message.user?.avatarColor || 'hsl(0, 0%, 90%)';
          const userInitials = username.slice(0, 2).toUpperCase();
          const isHighlighted = message.id === highlightedMessageId;

          return (
            <div
              key={message.id}
              id={`message-${message.id}`}
              ref={isHighlighted ? highlightedRef : undefined}
              className={`flex items-start gap-3 group ${
                isHighlighted ? 'bg-accent/20 -mx-4 px-4 py-2 rounded-md transition-colors duration-500' : ''
              }`}
            >
              <Avatar 
                className="h-8 w-8 mt-1"
                style={{ backgroundColor: avatarColor }}
              >
                <AvatarFallback
                  style={{ 
                    backgroundColor: avatarColor,
                    color: 'black'
                  }}
                >
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {username}
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
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}