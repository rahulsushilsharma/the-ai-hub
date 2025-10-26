import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAppStore } from "@/services/uiStore";
import { MessageSquareTextIcon, X } from "lucide-react";
import { Button } from "./ui/button";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const sessions = useAppStore((state) => state.sessions);
  const currentSession = useAppStore((state) => state.currentSession);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const removeSession = useAppStore((state) => state.removeSession);
  const setAppState = useAppStore((state) => state.setAppState);
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Button
          variant="default"
          className="w-full"
          onClick={() => {
            setCurrentSession(null);
          }}
        >
          New Chat
        </Button>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {sessions.map((item) => (
          <SidebarMenuItem key={item.id} className="hover:bg-accent flex group">
            <div className="flex w-full items-center hover:cursor-pointer border-b border-border p-1">
              <MessageSquareTextIcon />
              <SidebarMenuButton
                asChild
                onClick={() => setCurrentSession(item)}
                isActive={currentSession?.id === item.id}
              >
                <span className="truncate ml-2">{item.name}</span>
              </SidebarMenuButton>

              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:cursor-pointer"
                onClick={() => {
                  if (sessions.length === 1) {
                    localStorage.setItem("chat-sessions", JSON.stringify([]));
                  }
                  removeSession(item.id);
                  if (currentSession?.id === item.id) {
                    setCurrentSession(null);
                  }
                }}
              >
                <Button variant="outline" size="icon">
                  <X />
                </Button>
              </Button>
            </div>
          </SidebarMenuItem>
        ))}
        <SidebarFooter className="mt-auto sticky bottom-0 bg-accent shadow">
          <div className="p-2 text-sm text-center text-muted-foreground">
            <Button
              size="sm"
              className="w-full"
              onClick={() => setAppState({ settingsOpen: true })}
            >
              {" "}
              Settings
            </Button>
          </div>
        </SidebarFooter>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
