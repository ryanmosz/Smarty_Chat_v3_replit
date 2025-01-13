import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Trash2 } from "lucide-react";
import type { Message } from "@db/schema";
import { useChat } from "@/hooks/use-chat";

interface MessageListProps {
  messages: Message[];
  onThreadClick?: (message: Message) => void;
}

export function MessageList({ messages, onThreadClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { deleteMessage } = useChat();

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
          <div key={message.id} className="flex gap-3 group">
            <div className="flex-1">
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
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}