import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";

const EMOJI_LIST = ["👍", "❤️", "🎉", "🚀", "👋", "😊", "🔥", "✨"];

interface EmojiPickerProps {
  messageId: number;
}

export function EmojiPicker({ messageId }: EmojiPickerProps) {
  const { addReaction } = useChat();
  const { user } = useUser();

  const handleEmojiClick = async (emoji: string) => {
    if (!user) return;
    
    await addReaction.mutateAsync({
      messageId,
      emoji,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-2" align="start">
        <div className="grid grid-cols-4 gap-2">
          {EMOJI_LIST.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={() => handleEmojiClick(emoji)}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
