import { UserHeader } from "./user-header";
import { SearchBar } from "./search-bar";
import { LogoutButton } from "./user-header";

export function ChatHeader() {
  return (
    <div className="h-14 border-b bg-background px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <UserHeader />
        <SearchBar />
      </div>
      <LogoutButton />
    </div>
  );
}
