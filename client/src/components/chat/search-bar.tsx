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
  messages: (Message & { 
    user: User | null;
    channel: { id: number; name: string } | null;
  })[];
  directMessages: (DirectMessage & { 
    fromUser: User | null;
    toUser: User | null;
  })[];
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
        return { channels: [], messages: [], directMessages: [] };
      }

      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }

      return response.json();
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 0,
    retry: 1,
  });

  const handleMessageClick = (channelId: number | null, messageId: number) => {
    if (channelId) {
      setLocation(`/channel/${channelId}?message=${messageId}`);
      setShowResults(false);
      setQuery("");
    }
  };

  const handleDirectMessageClick = (userId: number | null) => {
    if (userId) {
      window.dispatchEvent(new CustomEvent('selectUser', { detail: userId }));
      setShowResults(false);
      setQuery("");
      setLocation('/');
    }
  };

  const formatDate = (dateString: string | Date | null) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, h:mm a');
    } catch (error) {
      console.error('Date formatting error:', error);
      return '';
    }
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

      {showResults && debouncedQuery.trim().length >= 2 && (
        <div className="absolute top-full mt-2 left-0 w-96 bg-background border rounded-md shadow-lg p-4 space-y-4 z-50">
          <ScrollArea className="max-h-[480px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !searchResults || (!searchResults.messages.length && !searchResults.directMessages.length) ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                {debouncedQuery.length < 2 ? 'Type to search...' : `No results found for "${debouncedQuery}"`}
              </div>
            ) : (
              <>
                {searchResults.messages.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm">Channel Messages</h3>
                    <div className="space-y-2">
                      {searchResults.messages.map((message) => (
                        <div
                          key={message.id}
                          className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                          onClick={() => handleMessageClick(message.channelId, message.id)}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar 
                              className="h-6 w-6"
                              style={{ backgroundColor: message.user?.avatarColor || 'hsl(0, 0%, 90%)' }}
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
                            <div>
                              <div className="text-sm font-medium">
                                {message.user?.username || "Unknown User"}
                              </div>
                              <div className="text-sm">{message.content}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(message.createdAt)} in #{message.channel?.name || "unknown-channel"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchResults.directMessages.length > 0 && (
                  <div className={searchResults.messages.length > 0 ? "mt-4" : ""}>
                    <h3 className="font-semibold mb-2 text-sm">Direct Messages</h3>
                    <div className="space-y-2">
                      {searchResults.directMessages.map((dm) => (
                        <div
                          key={dm.id}
                          className="p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                          onClick={() => handleDirectMessageClick(dm.fromUserId)}
                        >
                          <div className="flex items-start gap-2">
                            <Avatar 
                              className="h-6 w-6"
                              style={{ backgroundColor: dm.fromUser?.avatarColor || 'hsl(0, 0%, 90%)' }}
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
                            <div>
                              <div className="text-sm font-medium">
                                {dm.fromUser?.username || "Unknown User"} →{" "}
                                {dm.toUser?.username || "Unknown User"}
                              </div>
                              <div className="text-sm">{dm.content}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(dm.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}