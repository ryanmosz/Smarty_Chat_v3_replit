import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UserHeader() {
  const { user, logout } = useUser();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      const result = await logout();
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
        return;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    }
  };

  if (!user) return null;

  return (
    <div className="p-4 border-b flex items-center justify-between bg-background">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={user.avatarUrl || undefined} />
          <AvatarFallback>
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{user.username}</div>
          <div className="text-sm text-muted-foreground">
            {user.status || "Active"}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={handleLogout}>
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}
