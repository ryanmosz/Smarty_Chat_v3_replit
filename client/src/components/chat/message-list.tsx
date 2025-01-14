import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, FileIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Message, User, Reaction, Emoji } from "@db/schema";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";
import { EmojiPicker } from "./emoji-picker";
import { useQuery } from "@tanstack/react-query";

interface MessageWithUser extends Message {
  user?: User;
  reactions?: (Reaction & {
    user: User;
    emoji?: Emoji;
  })[];
}

interface MessageListProps {
  messages: MessageWithUser[];
  onThreadClick?: (message: MessageWithUser) => void;
  highlightedMessageId?: number;
}

// Helper function to parse and render message content
function renderMessageContent(content: string): React.ReactNode {
  try {
    if (!content) return '';

    // Regular expression to match markdown-style links: [text](/path)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${match.index}`}>
            {content.slice(lastIndex, match.index)}
          </span>
        );
      }

      // Add the link component
      const [, text, url] = match;
      if (url.startsWith('/uploads/')) {
        // It's an uploaded file
        parts.push(
          <a 
            key={`link-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <FileIcon className="h-4 w-4" />
            {text}
          </a>
        );
      } else {
        // Regular link
        parts.push(
          <a 
            key={`link-${match.index}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700"
          >
            {text}
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key="text-end">
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? <>{parts}</> : content;
  } catch (error) {
    console.error('Error rendering message content:', error);
    return <span>Error displaying message content.</span>;
  }
}

// Helper function to safely format dates
const formatDate = (dateString: string | Date | null) => {
  if (!dateString) return '';
  try {
    return format(new Date(dateString), 'MMM d, h:mm a');
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

function ReactionList({ reactions }: { reactions: MessageWithUser['reactions'] }) {
  if (!reactions?.length) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    const key = reaction.emoji?.id || reaction.emoji || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        emoji: reaction.emoji,
        count: 0,
        users: new Set(),
      };
    }
    acc[key].count++;
    acc[key].users.add(reaction.user.username);
    return acc;
  }, {} as Record<string, { emoji: any; count: number; users: Set<string> }>);

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.values(groupedReactions).map(({ emoji, count, users }, index) => (
        <div
          key={index}
          className="flex items-center gap-1 bg-accent/50 rounded-full px-2 py-0.5 text-sm"
          title={Array.from(users).join(', ')}
        >
          {emoji?.unicode || emoji?.imageUrl ? (
            emoji.unicode || (
              <img
                src={emoji.imageUrl}
                alt={emoji.shortcode}
                className="w-4 h-4 object-contain"
              />
            )
          ) : (
            emoji
          )}
          <span className="text-xs">{count}</span>
        </div>
      ))}
    </div>
  );
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
          if (!message) return null;

          const username = message.user?.username || 'Unknown User';
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
                    {formatDate(message.createdAt)}
                  </span>
                </div>
                <div className="mt-1">{renderMessageContent(message.content)}</div>
                <ReactionList reactions={message.reactions} />
                <div className="mt-2 flex items-center gap-2">
                  <EmojiPicker messageId={message.id} />
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