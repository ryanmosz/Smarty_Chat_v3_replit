import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smile, Loader2 } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Emoji, EmojiCategory } from "@db/schema";
import { useState } from "react";

interface EmojiPickerProps {
  messageId: number;
}

export function EmojiPicker({ messageId }: EmojiPickerProps) {
  const { addReaction } = useChat();
  const { user } = useUser();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch emoji categories with their emojis
  const { data: categories = [] } = useQuery<(EmojiCategory & { emojis: Emoji[] })[]>({
    queryKey: ['/api/emoji-categories'],
    queryFn: async () => {
      const response = await fetch('/api/emoji-categories');
      if (!response.ok) throw new Error('Failed to fetch emoji categories');
      return response.json();
    },
  });

  // Fetch all emojis (including custom ones)
  const { data: allEmojis = [] } = useQuery<Emoji[]>({
    queryKey: ['/api/emojis'],
    queryFn: async () => {
      const response = await fetch('/api/emojis');
      if (!response.ok) throw new Error('Failed to fetch emojis');
      return response.json();
    },
  });

  const handleEmojiClick = async (emoji: Emoji | string) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      if (typeof emoji === 'string') {
        // Handle legacy emoji format
        await addReaction.mutateAsync({
          messageId,
          emoji,
        });
      } else {
        // Handle new emoji format with proper error handling
        await addReaction.mutateAsync({
          messageId,
          emojiId: emoji.id,
        });
      }
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

  // Fallback emojis if API fails
  const fallbackEmojis = ["👍", "❤️", "🎉", "🚀", "👋", "😊", "🔥", "✨"];

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
      <PopoverContent className="w-80" align="start">
        <Tabs defaultValue="all">
          <TabsList className="w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.id.toString()}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="h-[300px] mt-2">
            <TabsContent value="all" className="m-0">
              <div className="grid grid-cols-8 gap-2 p-2">
                {allEmojis.length > 0 ? (
                  allEmojis.map((emoji) => (
                    <Button
                      key={emoji.id}
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-accent/50"
                      onClick={() => handleEmojiClick(emoji)}
                      disabled={isSubmitting}
                    >
                      {emoji.unicode || (
                        <img 
                          src={emoji.imageUrl || ''} 
                          alt={emoji.shortcode}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                    </Button>
                  ))
                ) : (
                  // Fallback to basic emojis if API fails
                  fallbackEmojis.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-accent/50"
                      onClick={() => handleEmojiClick(emoji)}
                      disabled={isSubmitting}
                    >
                      {emoji}
                    </Button>
                  ))
                )}
              </div>
            </TabsContent>

            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id.toString()} className="m-0">
                <div className="grid grid-cols-8 gap-2 p-2">
                  {category.emojis.map((emoji) => (
                    <Button
                      key={emoji.id}
                      variant="ghost"
                      className="h-8 w-8 p-0 hover:bg-accent/50"
                      onClick={() => handleEmojiClick(emoji)}
                      disabled={isSubmitting}
                    >
                      {emoji.unicode || (
                        <img 
                          src={emoji.imageUrl || ''} 
                          alt={emoji.shortcode}
                          className="w-6 h-6 object-contain"
                        />
                      )}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}