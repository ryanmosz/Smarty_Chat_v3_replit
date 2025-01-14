import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, SmileIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message, User, Reaction } from "@db/schema";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import { chatWs } from "@/lib/websocket";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MessageWithUser extends Message {
  user?: User;
  reactions?: (Reaction & { user?: User })[];
}

interface MessageListProps {
  messages: MessageWithUser[];
  onThreadClick?: (message: MessageWithUser) => void;
  highlightedMessageId?: number;
}

// Common emojis for quick reactions
const quickEmojis = ['👍', '❤️', '😂', '🎉', '🚀', '👀'];

export function MessageList({ messages, onThreadClick, highlightedMessageId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (highlightedMessageId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedMessageId]);

  const handleReaction = (messageId: number, emoji: string) => {
    if (!user) return;

    chatWs.send({
      type: 'reaction',
      payload: { messageId, emoji, userId: user.id }
    });

    setShowEmojiPicker(null);
  };

  const formatDate = (dateString: string | Date) => {
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
  };

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          if (!message) return null;

          const username = message.user?.username || 'Unknown User';
          const avatarColor = message.user?.avatarColor || 'hsl(0, 0%, 90%)';
          const userInitials = username.slice(0, 2).toUpperCase();
          const isHighlighted = message.id === highlightedMessageId;

          // Group reactions by emoji
          const reactionGroups = (message.reactions || []).reduce((acc, reaction) => {
            acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <div
              key={message.id}
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
                  <span className="font-semibold">{username}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(message.createdAt)}
                  </span>
                </div>
                <div className="mt-1">{message.content}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Display reaction groups */}
                  {Object.entries(reactionGroups).map(([emoji, count]) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-sm"
                      onClick={() => handleReaction(message.id, emoji)}
                    >
                      {emoji} {count}
                    </Button>
                  ))}

                  {/* Quick reaction buttons */}
                  <Popover open={showEmojiPicker === message.id} onOpenChange={(open) => setShowEmojiPicker(open ? message.id : null)}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 opacity-0 group-hover:opacity-100"
                      >
                        <SmileIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2">
                      <div className="flex gap-1">
                        {quickEmojis.map(emoji => (
                          <Button
                            key={emoji}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReaction(message.id, emoji)}
                          >
                            {emoji}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

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