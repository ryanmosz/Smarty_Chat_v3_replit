import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Message } from "@db/schema";

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
    <div className="p-4 border-b">
      <div className="flex gap-2">
        <Input
          placeholder="Search messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button variant="ghost" size="icon" onClick={handleSearch}>
          <Search className="h-5 w-5" />
        </Button>
      </div>
      {searchResults && searchResults.length > 0 && (
        <div className="mt-4 space-y-2">
          {searchResults.map((message) => (
            <div
              key={message.id}
              className="p-2 rounded bg-accent text-accent-foreground"
            >
              <div className="text-sm">{message.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
