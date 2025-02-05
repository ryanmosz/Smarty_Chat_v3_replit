import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";

export function UserHeader() {
  const { user } = useUser();

  return (
    <Avatar 
      className="h-8 w-8"
      style={{ backgroundColor: user?.avatarColor || 'hsl(0, 0%, 90%)' }}
    >
      <AvatarFallback 
        style={{ backgroundColor: user?.avatarColor || 'hsl(0, 0%, 90%)', color: 'black' }}
      >
        {user ? user.username.slice(0, 2).toUpperCase() : "U"}
      </AvatarFallback>
    </Avatar>
  );
}

export function LogoutButton() {
  const { logout } = useUser();
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

  return (
    <Button variant="ghost" size="icon" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
    </Button>
  );
}