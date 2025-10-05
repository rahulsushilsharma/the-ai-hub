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
import { Button } from "./ui/button";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  sessions: { id: string; name: string }[];
  currentSession: { id: string; name: string } | null;
  onSessionChange: ({ id, name }: { id: string; name: string }) => void;
}

export function AppSidebar({ ...props }: AppSidebarProps) {
  console.log("Rendering AppSidebar with props:", props.sessions);
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Button
          variant="default"
          className="w-full"
          onClick={() => {
            props.onSessionChange({ id: "-1", name: "New Chat" });
          }}
        >
          New Chat
        </Button>
        <SearchForm />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {/* We create a collapsible SidebarGroup for each parent. */}
        {props.sessions.map((item) => (
          <SidebarMenuItem key={item.id} className="hover:bg-accent">
            <SidebarMenuButton
              asChild
              onClick={() => props.onSessionChange(item)}
              isActive={props.currentSession?.id === item.id}
            >
              <span>{item.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
