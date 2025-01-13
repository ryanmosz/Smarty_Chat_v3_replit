import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function UserHeader() {
  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback>U</AvatarFallback>
    </Avatar>
  );
}

export function LogoutButton() {
  //const { logout } = useUser(); // Removed because not used in simplified version
  //const { toast } = useToast(); // Removed because not used in simplified version

  const handleLogout = async () => {
    // try {
    //   const result = await logout();
    //   if (!result.ok) {
    //     toast({
    //       variant: "destructive",
    //       title: "Error",
    //       description: result.message,
    //     });
    //     return;
    //   }
    // } catch (error) {
    //   toast({
    //     variant: "destructive",
    //     title: "Error",
    //     description: (error as Error).message,
    //   });
    // }
  };

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
      <LogOut className="h-4 w-4" />
    </Button>
  );
}