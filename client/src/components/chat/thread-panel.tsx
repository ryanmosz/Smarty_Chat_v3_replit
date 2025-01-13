import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import type { Message } from "@db/schema";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { useChat } from "@/hooks/use-chat";

interface ThreadPanelProps {
  parentMessage: Message;
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
          <div className="font-medium">Original Message</div>
          <div className="mt-2">{parentMessage.content}</div>
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