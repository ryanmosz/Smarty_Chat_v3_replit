import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Message, User } from "@db/schema";
import { useChat } from "@/hooks/use-chat";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";

interface MessageWithUser extends Message {
  user?: User;
}

interface MessageListProps {
  messages: MessageWithUser[];
  onThreadClick?: (message: MessageWithUser) => void;
}

export function MessageList({ messages, onThreadClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deleteMessage } = useChat();
  const { user } = useUser();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDelete = async (messageId: number) => {
    try {
      await deleteMessage.mutateAsync(messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => {
          const username = message.user?.username || 'Unknown';
          const avatarColor = message.user?.avatarColor || 'hsl(0, 0%, 90%)';
          const userInitials = username.slice(0, 2).toUpperCase();

          return (
            <div key={message.id} className="flex items-start gap-3 group">
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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Message</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this message? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(message.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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