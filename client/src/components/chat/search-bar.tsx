import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message, Channel, DirectMessage, User } from "@db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

interface SearchResults {
  channels: Channel[];
  messages: (Message & { user?: User })[];
  directMessages: (DirectMessage & { fromUser?: User; toUser?: User })[];
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: searchResults, isLoading, refetch } = useQuery<SearchResults>({
    queryKey: [`/api/search`, query],
    enabled: false,
    initialData: { channels: [], messages: [], directMessages: [] }
  });

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    await refetch();
    setIsSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const hasResults = searchResults && (
    searchResults.channels.length > 0 || 
    searchResults.messages.length > 0 || 
    searchResults.directMessages.length > 0
  );

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <Input
          placeholder="Search messages and channels..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-64 text-sm pr-8"
        />
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-0 top-0 h-8 w-8"
          onClick={handleSearch}
          disabled={isLoading || isSearching}
        >
          {isLoading || isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isSearching || (query && hasResults) ? (
        <div className="absolute top-full mt-2 left-0 w-96 max-h-[500px] overflow-y-auto bg-background border rounded-md shadow-lg p-4 space-y-4 z-50">
          {isLoading || isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Channels */}
              {searchResults.channels.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Channels</h3>
                  <div className="space-y-2">
                    {searchResults.channels.map((channel) => (
                      <div
                        key={channel.id}
                        className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="font-medium">#{channel.name}</div>
                        {channel.description && (
                          <div className="text-sm text-muted-foreground">{channel.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {searchResults.messages.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Messages</h3>
                  <div className="space-y-2">
                    {searchResults.messages.map((message) => (
                      <div
                        key={message.id}
                        className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback>
                              {message.user?.username?.slice(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">
                              {message.user?.username || "Unknown"}
                            </div>
                            <div className="text-sm">{message.content}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Messages */}
              {searchResults.directMessages.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Direct Messages</h3>
                  <div className="space-y-2">
                    {searchResults.directMessages.map((dm) => (
                      <div
                        key={dm.id}
                        className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                      >
                        <div className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback>
                              {dm.fromUser?.username?.slice(0, 2).toUpperCase() || "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium">
                              {dm.fromUser?.username || "Unknown"} → {dm.toUser?.username || "Unknown"}
                            </div>
                            <div className="text-sm">{dm.content}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(dm.createdAt), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!hasResults && query && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No results found for "{query}"
                </div>
              )}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}