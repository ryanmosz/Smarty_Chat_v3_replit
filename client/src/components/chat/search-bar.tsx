import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message, Channel, DirectMessage } from "@db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface SearchResults {
  channels: Channel[];
  messages: (Message & { user?: { username: string; avatarColor?: string }; channel?: Channel })[];
  directMessages: (DirectMessage & { fromUser?: { username: string; avatarColor?: string }; toUser?: { username: string; avatarColor?: string } })[];
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: searchResults } = useQuery<SearchResults>({
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
      {searchResults && (searchResults.channels.length > 0 || searchResults.messages.length > 0 || searchResults.directMessages.length > 0) && (
        <div className="absolute top-full mt-2 w-full max-w-md bg-background border rounded-md shadow-lg p-2 space-y-4">
          {/* Channels */}
          {searchResults.channels.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Channels</h3>
              {searchResults.channels.map((channel) => (
                <div
                  key={channel.id}
                  className="p-2 rounded bg-accent/50 text-accent-foreground mb-2"
                >
                  <div className="font-medium">#{channel.name}</div>
                  {channel.description && (
                    <div className="text-sm text-muted-foreground">{channel.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Channel Messages */}
          {searchResults.messages.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Messages in Channels</h3>
              {searchResults.messages.map((message) => (
                <div
                  key={message.id}
                  className="p-2 rounded bg-accent text-accent-foreground mb-2"
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
                        {message.user?.username?.slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center text-sm">
                        <span className="font-medium">
                          {message.user?.username || "Unknown User"}
                          {message.channel && <span className="text-muted-foreground"> in #{message.channel.name}</span>}
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

          {/* Direct Messages */}
          {searchResults.directMessages.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Direct Messages</h3>
              {searchResults.directMessages.map((dm) => (
                <div
                  key={dm.id}
                  className="p-2 rounded bg-accent text-accent-foreground mb-2"
                >
                  <div className="flex items-start gap-2">
                    <Avatar 
                      className="h-6 w-6"
                      style={{ 
                        backgroundColor: dm.fromUser?.avatarColor || 'hsl(0, 0%, 90%)'
                      }}
                    >
                      <AvatarFallback
                        style={{ 
                          backgroundColor: dm.fromUser?.avatarColor || 'hsl(0, 0%, 90%)',
                          color: 'black'
                        }}
                      >
                        {dm.fromUser?.username?.slice(0, 2).toUpperCase() || "??"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex gap-2 items-center text-sm">
                        <span className="font-medium">
                          {dm.fromUser?.username || "Unknown"} → {dm.toUser?.username || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dm.createdAt && format(new Date(dm.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <div className="text-sm mt-1">{dm.content}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}