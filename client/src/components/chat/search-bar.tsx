import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: searchResults } = useQuery<Message[]>({
    queryKey: [`/api/search?q=${debouncedQuery}`],
    enabled: debouncedQuery.length > 0,
  });

  const handleSearch = () => {
    setDebouncedQuery(query);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Input
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-8 w-40 text-sm"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-0 top-0 h-8 w-8"
          onClick={handleSearch}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {searchResults && searchResults.length > 0 && (
        <div className="absolute top-full mt-2 w-full max-w-md bg-background border rounded-md shadow-lg p-2 space-y-2">
          {searchResults.map((message) => (
            <div
              key={message.id}
              className="p-2 rounded bg-accent text-accent-foreground"
            >
              <div className="flex items-start gap-2">
                <Avatar 
                  className="h-6 w-6"
                  style={{ 
                    backgroundColor: message.user?.avatarColor || 'hsl(0, 0%, 90%)'
                  }}
                >
                  <AvatarFallback
                    style={{ 
                      backgroundColor: message.user?.avatarColor || 'hsl(0, 0%, 90%)',
                      color: 'black'
                    }}
                  >
                    {message.user?.username.slice(0, 2).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex gap-2 items-center text-sm">
                    <span className="font-medium">
                      {message.user?.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {message.createdAt && format(new Date(message.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <div className="text-sm mt-1">{message.content}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}