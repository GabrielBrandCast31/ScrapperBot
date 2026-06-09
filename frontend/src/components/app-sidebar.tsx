import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessagesSquare,
  Users,
  ShieldCheck,
  Sparkles,
  Bell,
  Smartphone,
  BarChart3,
  Globe,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const nav = [
  { title: "Visão Geral", url: "/", icon: LayoutDashboard },
  { title: "Conexão", url: "/conexao", icon: Smartphone },
  { title: "Insights", url: "/insights", icon: BarChart3 },
  { title: "Conversas", url: "/conversas", icon: MessagesSquare },
  { title: "Clientes", url: "/clientes", icon: Users },
  { title: "Auditoria IA", url: "/auditoria", icon: ShieldCheck },
  { title: "Chat IA", url: "/chat-ia", icon: Sparkles },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-full text-primary-foreground"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            <Globe className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Agência</div>
              <div className="text-sm font-extrabold tracking-wide text-sidebar-foreground">
                BRAND<span className="text-primary">CAST</span>
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Painel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-2 py-2">
          <Bell className="h-4 w-4 text-primary" />
          {!collapsed && (
            <div className="text-xs leading-tight">
              <div className="font-medium text-sidebar-foreground">4 alertas</div>
              <div className="text-muted-foreground">conversas em risco</div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}