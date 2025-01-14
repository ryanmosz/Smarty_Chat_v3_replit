import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Plus, Trash2, ChevronDown, ChevronRight, UserIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { chatWs } from "@/lib/websocket";

interface DirectMessageListProps {
  users: User[];
  selectedUserId?: number;
  onUserSelect: (userId: number) => void;
}

export function DirectMessageList({
  users,
  selectedUserId,
  onUserSelect,
}: DirectMessageListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDMs, setShowDMs] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user: currentUser } = useUser();

  const filteredUsers = users
    .filter(u => u.id !== currentUser?.id)
    .filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleStartDM = async (userId: number) => {
    if (isNaN(userId)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid user selected",
      });
      return;
    }

    setIsOpen(false);
    setSearchQuery("");
    onUserSelect(userId);
  };

  return (
    <div className="flex flex-col">
      <div className="p-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowDMs(!showDMs)}
            className="p-0 h-5 w-5"
          >
            {showDMs ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          <span className="font-semibold">Direct Messages</span>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Direct Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-2">
                  {filteredUsers.map((user) => (
                    <Button
                      key={user.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => handleStartDM(user.id)}
                    >
                      <UserIcon className="h-4 w-4 mr-2" />
                      {user.username}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className={`flex-1 overflow-hidden transition-all duration-200 ${showDMs ? 'max-h-[calc(100vh-5rem)]' : 'max-h-0'}`}>
        <ScrollArea className="h-full">
          <div className="space-y-1 p-2">
            {users
              .filter(u => u.id !== currentUser?.id)
              .map((user) => (
                <div key={user.id} className="flex items-center gap-2 group">
                  <Button
                    variant={user.id === selectedUserId ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => onUserSelect(user.id)}
                  >
                    <UserIcon className="h-4 w-4 mr-2" />
                    {user.username}
                  </Button>
                </div>
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}