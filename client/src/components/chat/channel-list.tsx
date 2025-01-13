import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useChat } from "@/hooks/use-chat";
import { useUser } from "@/hooks/use-user";
import type { Channel } from "@db/schema";

interface ChannelListProps {
  channels: Channel[];
  selectedChannelId?: number;
  onChannelSelect: (channelId: number) => void;
}

export function ChannelList({
  channels,
  selectedChannelId,
  onChannelSelect,
}: ChannelListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { sendMessage } = useChat();
  const { user } = useUser();

  const handleCreateChannel = async () => {
    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (response.ok) {
        setIsOpen(false);
        setName("");
        setDescription("");
      }
    } catch (error) {
      console.error("Failed to create channel:", error);
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete channel");
      }
    } catch (error) {
      console.error("Error deleting channel:", error);
    }
  };

  return (
    <div className="w-60 border-r bg-background">
      <div className="p-4 flex items-center justify-between">
        <h2 className="font-semibold">Channels</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Channel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Channel Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleCreateChannel}>Create Channel</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ScrollArea className="h-[calc(100vh-10rem)]">
        <div className="space-y-1 p-2">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-2">
              <Button
                variant={channel.id === selectedChannelId ? "secondary" : "ghost"}
                className="w-full justify-start"
                onClick={() => onChannelSelect(channel.id)}
              >
                <Hash className="h-4 w-4 mr-2" />
                {channel.name}
              </Button>
              {channel.createdById === user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteChannel(channel.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}