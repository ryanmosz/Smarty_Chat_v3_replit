import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile, Loader2 } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface EmojiPickerProps {
  messageId: number;
}

// Basic set of commonly used emojis
const BASIC_EMOJIS = [
  "👍", "❤️", "😊", "🎉", "🚀", "👋", "🔥", "✨",
  "👀", "💯", "⭐", "🌟", "👏", "🙌", "💪", "🤝"
];

export function EmojiPicker({ messageId }: EmojiPickerProps) {
  const { addReaction } = useChat();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmojiClick = async (emoji: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to add reactions",
      });
      return;
    }

    console.log('Adding reaction:', { messageId, emoji }); // Debug log

    setIsSubmitting(true);
    try {
      await addReaction.mutateAsync({
        messageId,
        emoji,
      });

      toast({
        description: "Reaction added successfully",
        duration: 2000,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add reaction. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="opacity-0 group-hover:opacity-100"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smile className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <div className="grid grid-cols-8 gap-2 p-2">
          {BASIC_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-accent/50"
              onClick={() => handleEmojiClick(emoji)}
              disabled={isSubmitting}
            >
              {emoji}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}