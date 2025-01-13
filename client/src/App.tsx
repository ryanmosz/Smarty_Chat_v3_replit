import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import ChatPage from "@/pages/chat-page";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { chatWs } from "./lib/websocket";

function Router() {
  useEffect(() => {
    chatWs.connect();
    return () => chatWs.disconnect();
  }, []);

  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;