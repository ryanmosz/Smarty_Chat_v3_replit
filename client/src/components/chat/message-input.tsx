import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";

interface MessageInputProps {
  channelId?: number;
  threadParentId?: number;
  toUserId?: number;
}

export function MessageInput({ channelId, threadParentId, toUserId }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { sendMessage, sendDirectMessage } = useChat();
  const { toast } = useToast();
  const { user } = useUser();

  const handleSubmit = async () => {
    if (!content.trim()) return;

    try {
      if (toUserId && user?.id) {
        await sendDirectMessage.mutateAsync({
          content: content.trim(),
          toUserId,
          fromUserId: user.id
        });
      } else if (channelId) {
        await sendMessage.mutateAsync({
          content: content.trim(),
          channelId,
          threadParentId,
          userId: user?.id
        });
      }
      setContent("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send message",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { url } = await response.json();
      const fileMessage = `[${file.name}](${url})`;

      if (toUserId && user?.id) {
        await sendDirectMessage.mutateAsync({
          content: fileMessage,
          toUserId,
          fromUserId: user.id
        });
      } else if (channelId) {
        await sendMessage.mutateAsync({
          content: fileMessage,
          channelId,
          threadParentId,
          userId: user?.id
        });
      }

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload file",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-4 border-t bg-background">
      <div className="flex gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
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