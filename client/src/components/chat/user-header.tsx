import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function UserHeader() {
  const { user } = useUser();

  if (!user) return null;

  return (
    <>
      <Avatar className="h-8 w-8" style={{ backgroundColor: user.avatarColor || 'hsl(0, 0%, 90%)' }}>
        <AvatarImage src={user.avatarUrl || undefined} />
        <AvatarFallback style={{ backgroundColor: user.avatarColor || 'hsl(0, 0%, 90%)' }}>
          {user.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    </>
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
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
    </Button>
  );
}