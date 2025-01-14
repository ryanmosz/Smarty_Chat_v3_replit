import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2 } from "lucide-react";
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
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { useChat } from "@/hooks/use-chat";
import { format } from "date-fns";
import { useUser } from "@/hooks/use-user";

interface MessageWithUser extends Message {
  user?: User;
}

interface ThreadPanelProps {
  parentMessage: MessageWithUser;
  onClose: () => void;
}

export function ThreadPanel({ parentMessage, onClose }: ThreadPanelProps) {
  const { getThreadMessages, deleteMessage } = useChat();
  const { data: threadMessages = [] } = getThreadMessages(parentMessage.id);
  const { user } = useUser();

  const handleDelete = async (messageId: number) => {
    try {
      await deleteMessage.mutateAsync(messageId);
      if (messageId === parentMessage.id) {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <div className="w-80 border-l bg-background flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold">Thread</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 border-b bg-accent/20">
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
                {parentMessage.user?.username?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {parentMessage.user?.username || "Unknown User"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {parentMessage.createdAt && format(new Date(parentMessage.createdAt), 'MMM d, h:mm a')}
                </span>
              </div>
              <div className="mt-1">{parentMessage.content}</div>
              <div className="mt-2 flex items-center gap-2">
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
                      <AlertDialogTitle>Delete Thread</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this thread? This action cannot be undone and will close the thread view.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(parentMessage.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
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