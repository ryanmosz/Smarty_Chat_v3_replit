import { UserHeader } from "./user-header";
import { SearchBar } from "./search-bar";
import { LogoutButton } from "./user-header";
import { Logo } from "@/components/ui/logo";

export function ChatHeader() {
  return (
    <div className="h-14 border-b bg-background px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Logo />
        <SearchBar />
      </div>
      <div className="flex items-center gap-4">
        <UserHeader />
        <LogoutButton />
      </div>
    </div>
  );
}