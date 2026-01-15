import {
  MessageSquareTextIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/services/uiStore";
import { Button } from "./ui/button";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const sessions = useAppStore((state) => state.sessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const removeSession = useAppStore((state) => state.removeSession);
  const setAppState = useAppStore((state) => state.setAppState);

  const handleRemoveSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent switching to the session before deleting
    if (sessions.length === 1) {
      localStorage.setItem("chat-sessions", JSON.stringify([]));
    }
    removeSession(id);
    if (currentSession?.id === id) {
      setCurrentSession(null);
    }
  };

  return (
    <Sidebar variant="floating" collapsible="icon" {...props}>
      <SidebarHeader className="p-4">
        <Button variant="secondary" onClick={() => setCurrentSession(null)}>
          <PlusIcon className="size-4" />
          <span className="font-semibold">New Chat</span>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sessions.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setCurrentSession(item)}
                    isActive={currentSession?.id === item.id}
                    tooltip={item.name}
                    className={cn(
                      "py-5 transition-colors",
                      currentSession?.id === item.id
                        ? "bg-accent"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <MessageSquareTextIcon className="size-4 opacity-70" />
                    <span className="truncate font-medium">{item.name}</span>
                  </SidebarMenuButton>

                  {/* Modern 'Action' button for deletion */}
                  <SidebarMenuAction
                    onClick={(e) => handleRemoveSession(e, item.id)}
                    className="hover:text-destructive transition-colors"
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">Delete Chat</span>
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setAppState({ settingsOpen: true })}
              className="gap-3"
            >
              <Settings2Icon className="size-4 opacity-70" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
