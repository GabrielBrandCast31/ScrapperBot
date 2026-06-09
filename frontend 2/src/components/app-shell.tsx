import type { ReactNode } from "react";
import { Search, Calendar, RefreshCw } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div
        className="dark min-h-screen flex w-full bg-background text-foreground relative"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <div className="relative hidden md:block flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa, cliente, tópico…"
                className="h-9 pl-9 bg-muted/40 border-border"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Últimos 7 dias</span>
              </Button>
              <Button variant="ghost" size="icon" aria-label="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full grid place-items-center text-xs font-semibold text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                GB
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}