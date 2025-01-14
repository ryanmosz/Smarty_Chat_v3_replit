import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message, Channel, DirectMessage, User } from "@db/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

interface SearchResults {
  channels: Channel[];
  messages: (Message & { user?: User })[];
  directMessages: (DirectMessage & { fromUser?: User; toUser?: User })[];
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [, setLocation] = useLocation();

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim().length >= 2) {
        console.log('Setting debounced query:', query);
        setDebouncedQuery(query);
        setShowResults(true);
      } else {
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const { data: searchResults, isLoading } = useQuery<SearchResults>({
    queryKey: ['/api/search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        console.log('Empty query, returning empty results');
        return { channels: [], messages: [], directMessages: [] };
      }

      console.log('Fetching search results for:', debouncedQuery);
      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);

      if (!response.ok) {
        console.error('Search request failed:', response.status, response.statusText);
        throw new Error('Search failed');
      }

      const data = await response.json();
      console.log('Search results:', data);
      return data;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 1000, // Reduce stale time to ensure fresher results
    retry: 1,
    initialData: { channels: [], messages: [], directMessages: [] }
  });

  const hasResults = searchResults && (
    searchResults.messages?.length > 0
  );

  const handleMessageClick = (channelId: number, messageId: number) => {
    console.log('Navigating to message:', { channelId, messageId });
    setLocation(`/channel/${channelId}#message-${messageId}`);
    setShowResults(false);
    setQuery("");
  };

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <Input
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
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
        <div className="absolute top-full mt-2 left-0 w-96 bg-background border rounded-md shadow-lg p-4 space-y-4 z-50">
          <ScrollArea className="max-h-[480px]">
            {/* Messages */}
            {searchResults?.messages?.length > 0 ? (
              <div>
                <h3 className="font-semibold mb-2 text-sm">Messages</h3>
                <div className="space-y-2">
                  {searchResults.messages.map((message) => (
                    <div
                      key={message.id}
                      className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                      onClick={() => handleMessageClick(message.channelId!, message.id)}
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
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                {query.length < 2 ? 'Type to search...' : `No results found for "${query}"`}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}