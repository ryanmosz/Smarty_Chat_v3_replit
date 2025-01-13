import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Trash2 } from "lucide-react";
import type { Message, User } from "@db/schema";
import { useChat } from "@/hooks/use-chat";
import { EmojiPicker } from "./emoji-picker";
import { format } from "date-fns";

interface MessageListProps {
  messages: Message[];
  users: User[];
  onThreadClick?: (message: Message) => void;
}

export function MessageList({ messages, users, onThreadClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deleteMessage } = useChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getUser = (userId: number) => {
    return users.find((u) => u.id === userId);
  };

  const handleDelete = async (messageId: number) => {
    await deleteMessage.mutateAsync(messageId);
  };

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          const user = getUser(message.userId);
          if (!user) return null;

          return (
            <div key={message.id} className="flex gap-3 group">
              <Avatar>
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback>
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.username}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(message.createdAt), "p")}
                  </span>
                </div>
                <div className="mt-1">{message.content}</div>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => handleDelete(message.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
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
