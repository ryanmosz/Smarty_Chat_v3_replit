import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useToast } from "@/hooks/use-toast";
import { chatWs } from "@/lib/websocket";

interface MessageInputProps {
  channelId: number;
  threadParentId?: number;
}

export function MessageInput({ channelId, threadParentId }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const { sendMessage } = useChat();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      chatWs.send({
        type: "typing",
        payload: { channelId },
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      await sendMessage.mutateAsync({
        content,
        channelId,
        threadParentId,
      });
      setContent("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "File size must be less than 5MB",
      });
      return;
    }

    // TODO: Implement file upload
    toast({
      title: "Coming Soon",
      description: "File upload will be available soon!",
    });
  };

  return (
    <div className="p-4 border-t bg-background">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type a message..."
          className="min-h-[60px]"
        />
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="default" size="icon" onClick={handleSubmit}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
