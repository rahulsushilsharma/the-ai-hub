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
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <Button
          variant="secondary"
          aria-label="New chat"
          className="group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          onClick={() => setCurrentSession(null)}
        >
          <PlusIcon className="size-4" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">
            New chat
          </span>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            {sessions.length === 0 && (
              <p className="px-2 py-4 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                No chats yet. Send a message to start one.
              </p>
            )}
            <SidebarMenu>
              {sessions.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setCurrentSession(item)}
                    isActive={currentSession?.id === item.id}
                    tooltip={item.name}
                    className="py-5 transition-colors"
                  >
                    <MessageSquareTextIcon className="size-4 opacity-70" />
                    <span className="truncate font-medium">{item.name}</span>
                  </SidebarMenuButton>

                                    <SidebarMenuAction
                    onClick={(e) => handleRemoveSession(e, item.id)}
                    className="hover:text-destructive transition-colors"
                  >
                    <Trash2Icon className="size-3.5" />
                    <span className="sr-only">Delete chat</span>
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t group-data-[collapsible=icon]:p-2">
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
