import * as React from "react";

import { SearchForm } from "@/components/search-form";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
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
        <SearchForm />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {sessions.map((item) => (
          <SidebarMenuItem key={item.id} className="hover:bg-accent flex group">
            <SidebarMenuButton
              asChild
              onClick={() => setCurrentSession(item)}
              isActive={currentSession?.id === item.id}
            >
              <span>{item.name}</span>
            </SidebarMenuButton>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeSession(item.id)}
            >
              ×
            </Button>
          </SidebarMenuItem>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
