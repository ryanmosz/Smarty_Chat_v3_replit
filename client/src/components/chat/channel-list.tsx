import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Hash, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import type { Channel } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { chatWs } from "@/lib/websocket";

interface ChannelListProps {
  channels: Channel[];
  selectedChannelId?: number;
  onChannelSelect: (channelId: number) => void;
  onShowChannelsChange?: (showChannels: boolean) => void;
}

export function ChannelList({
  channels,
  selectedChannelId,
  onChannelSelect,
  onShowChannelsChange,
}: ChannelListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showChannels, setShowChannels] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const { user } = useUser();

  const handleShowChannelsToggle = () => {
    const newShowChannels = !showChannels;
    setShowChannels(newShowChannels);
    onShowChannelsChange?.(newShowChannels);
  };

  const handleCreateChannel = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Channel name is required",
      });
      return;
    }

    try {
      const response = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          description,
          createdById: user?.id 
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setIsOpen(false);
      setName("");
      setDescription("");
      toast({
        title: "Success",
        description: "Channel created successfully",
      });
    } catch (err) {
      const error = err as Error;
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create channel",
      });
    }
  };

  const handleDeleteChannel = async (channelId: number) => {
    try {
      const response = await fetch(`/api/channels/${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (selectedChannelId === channelId) {
        onChannelSelect(0);
      }

      chatWs.send({
        type: 'channel_deleted',
        payload: { id: channelId }
      });

      toast({
        title: "Success",
        description: "Channel deleted successfully",
      });
    } catch (err) {
      const error = err as Error;
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete channel",
      });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleShowChannelsToggle}
            className="p-0 h-5 w-5"
          >
            {showChannels ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <span className="font-semibold">Channels</span>
        </div>
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateChannel();
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">Channel Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      e.preventDefault();
                      handleCreateChannel();
                    }
                  }}
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
              <Button type="submit" disabled={!name.trim()}>
                Create Channel
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className={`overflow-hidden transition-all duration-200 ${showChannels ? 'max-h-[500px]' : 'max-h-0'}`}>
        <ScrollArea className="h-full">
          <div className="space-y-1 p-2">
            {channels.map((channel) => (
              <div key={channel.id} className="flex items-center gap-2 group">
                <Button
                  variant={channel.id === selectedChannelId ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onChannelSelect(channel.id)}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {channel.name}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this channel? This action cannot be undone and will delete all messages in this channel.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteChannel(channel.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}