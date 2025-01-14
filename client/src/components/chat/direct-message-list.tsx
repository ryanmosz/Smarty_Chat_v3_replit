import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ChevronDown, ChevronRight, UserIcon, Moon, Clock, MinusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { User } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-user";
import { useChat } from "@/hooks/use-chat";
import { chatWs } from "@/lib/websocket";

interface DirectMessageListProps {
  users: User[];
  selectedUserId?: number;
  onUserSelect: (userId: number) => void;
}

const statusIcons = {
  online: <div className="h-2 w-2 rounded-full bg-green-500" />,
  busy: <MinusCircle className="h-4 w-4 text-red-500" />,
  snooze: <Clock className="h-4 w-4 text-yellow-500" />,
  offline: <div className="h-2 w-2 rounded-full bg-gray-400" />,
};

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
  const { activeConversations } = useChat();

  // Filter users for search dialog
  const filteredUsers = users
    .filter(u => u.id !== currentUser?.id)
    .filter(u => 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Get users with active conversations
  const activeUsers = users.filter(user => 
    activeConversations.some(conv => 
      (conv.fromUserId === user.id && conv.toUserId === currentUser?.id) ||
      (conv.toUserId === user.id && conv.fromUserId === currentUser?.id)
    )
  );

  const handleStatusChange = async (newStatus: string) => {
    if (!currentUser) return;

    // Update local state first for immediate feedback
    const updatedUser = { ...currentUser, customStatus: newStatus, status: newStatus };
    // Find and update the current user in the users array
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
    }

    // Send WebSocket message
    chatWs.send({
      type: 'user_status',
      payload: {
        userId: currentUser.id,
        status: newStatus
      }
    });

    toast({
      title: "Status Updated",
      description: `Your status is now set to ${newStatus}`,
    });
  };

  const handleStartDM = async (userId: number) => {
    if (isNaN(userId)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid user selected",
      });
      return;
    }

    try {
      setIsOpen(false);
      setSearchQuery("");
      onUserSelect(userId);
    } catch (error) {
      console.error('Error starting DM:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start direct message",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-red-500';
      case 'snooze':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const currentStatus = currentUser?.customStatus || 'online';

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
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                <div className="flex items-center gap-2">
                  {statusIcons[currentStatus as keyof typeof statusIcons]}
                  <span className="text-xs capitalize">{currentStatus}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleStatusChange('online')}>
                <div className="flex items-center gap-2">
                  {statusIcons.online}
                  <span>Online</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('busy')}>
                <div className="flex items-center gap-2">
                  {statusIcons.busy}
                  <span>Busy</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('snooze')}>
                <div className="flex items-center gap-2">
                  {statusIcons.snooze}
                  <span>Snooze</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('offline')}>
                <div className="flex items-center gap-2">
                  {statusIcons.offline}
                  <span>Appear Offline</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  autoFocus
                />
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <Button
                          key={user.id}
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => handleStartDM(user.id)}
                        >
                          <div className="relative">
                            <UserIcon className="h-4 w-4 mr-2" />
                            <div 
                              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${
                                getStatusColor(user.customStatus || 'offline')
                              }`}
                            />
                          </div>
                          {user.username}
                        </Button>
                      ))
                    ) : (
                      <div className="text-sm text-muted-foreground p-2">
                        No users found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className={`flex-1 overflow-hidden transition-all duration-200 ${showDMs ? 'max-h-[calc(100vh-5rem)]' : 'max-h-0'}`}>
        <ScrollArea className="h-full">
          <div className="space-y-1 p-2">
            {activeUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 group">
                <Button
                  variant={user.id === selectedUserId ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => onUserSelect(user.id)}
                >
                  <div className="relative">
                    <UserIcon className="h-4 w-4 mr-2" />
                    <div 
                      className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${
                        getStatusColor(user.customStatus || 'offline')
                      }`}
                    />
                  </div>
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