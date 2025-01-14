import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
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
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length >= 2) {
        setDebouncedQuery(query);
      }
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const { data: searchResults, isLoading } = useQuery<SearchResults>({
    queryKey: ['/api/search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return { channels: [], messages: [], directMessages: [] };
      }
      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return response.json();
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5000, // Keep results fresh for 5 seconds
    retry: 1,
    initialData: { channels: [], messages: [], directMessages: [] }
  });

  const hasResults = searchResults && (
    (searchResults.channels?.length || 0) > 0 || 
    (searchResults.messages?.length || 0) > 0 || 
    (searchResults.directMessages?.length || 0) > 0
  );

  const showResults = query.trim().length >= 2;

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <Input
          placeholder="Search messages and channels..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-64 text-sm pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {showResults && (
        <div className="absolute top-full mt-2 left-0 w-96 max-h-[500px] overflow-y-auto bg-background border rounded-md shadow-lg p-4 space-y-4 z-50">
          {/* Channels */}
          {searchResults?.channels?.length > 0 && (
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
          {searchResults?.messages?.length > 0 && (
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
                          {message.user?.username || "Unknown User"}
                        </div>
                        <div className="text-sm">{message.content}</div>
                        {message.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(message.createdAt), 'MMM d, h:mm a')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Direct Messages */}
          {searchResults?.directMessages?.length > 0 && (
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
                        {dm.createdAt && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(dm.createdAt), 'MMM d, h:mm a')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isLoading && !hasResults && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {query.length < 2 ? 'Type to search...' : `No results found for "${query}"`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}