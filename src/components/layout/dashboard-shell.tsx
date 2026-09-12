"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Gift,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { authorize, type Permission } from "@/domain/auth/permissions";
import type { DemoSession } from "@/server/auth/session";

const primaryNavigation = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard, permission: "appointments:view" },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, permission: "appointments:view" },
  { href: "/agendamentos", label: "Agendamentos", icon: Scissors, permission: "appointments:view" },
  { href: "/clientes", label: "Clientes", icon: Users, permission: "customers:view" },
  { href: "/equipe", label: "Equipe", icon: UserRound, permission: "team:edit" },
  { href: "/servicos", label: "Serviços", icon: Scissors, permission: "services:view" },
  { href: "/fila-de-espera", label: "Fila de espera", icon: Sparkles, permission: "waitlist:view" },
] as const;

const growthNavigation = [
  { href: "/campanhas", label: "Campanhas", icon: Megaphone, permission: "campaigns:create" },
  { href: "/fidelidade", label: "Fidelidade", icon: Gift, permission: "loyalty:view" },
  { href: "/produtos", label: "Produtos", icon: Package, permission: "products:view" },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign, permission: "finance:view" },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "finance:view" },
] as const;

function NavLinks({ role, onNavigate }: { role: DemoSession["role"]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const renderGroup = (items: readonly { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[]) => items.filter((item) => authorize(role, item.permission)).map((item) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
          active ? "bg-brand/12 font-medium text-brand" : "text-muted-foreground hover:bg-white/8 hover:text-white",
        )}
      >
        <Icon className="size-4" />{item.label}
      </Link>
    );
  });
  return <nav className="flex flex-col gap-1"><p className="px-3 pb-2 pt-4 font-mono text-[10px] uppercase tracking-[.22em] text-white/60">Operação</p>{renderGroup(primaryNavigation)}<p className="px-3 pb-2 pt-6 font-mono text-[10px] uppercase tracking-[.22em] text-white/60">Crescimento</p>{renderGroup(growthNavigation)}</nav>;
}

export function DashboardShell({ children, session, notificationCount }: { children: React.ReactNode; session: DemoSession; notificationCount: number }) {
  const pathname = usePathname();
  const initials = session.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <div className="relative min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-white/8 bg-sidebar p-4 lg:flex">
        <Link href="/painel" className="px-2 py-3"><BrandMark /></Link>
        <div className="mt-2 flex-1 overflow-y-auto"><NavLinks role={session.role} /></div>
        {authorize(session.role, "settings:edit") ? <Link href="/configuracoes" className="mt-2 flex h-10 items-center gap-3 border-t border-white/15 px-3 text-xs uppercase tracking-[.12em] text-white/55 transition-colors hover:bg-white hover:text-black"><Settings className="size-4" /> Configurações</Link> : null}
      </aside>

      <div className="relative z-10 lg:pl-[244px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/8 bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden"><Menu /><span className="sr-only">Abrir navegação</span></Button></SheetTrigger>
            <SheetContent side="left" className="w-[290px] p-3"><SheetHeader className="px-2"><SheetTitle className="sr-only">Navegação</SheetTitle><BrandMark /></SheetHeader><NavLinks role={session.role} /></SheetContent>
          </Sheet>
          <form action="/busca" className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar no sistema" name="q" placeholder="Buscar clientes, reservas..." className="h-10 rounded-xl border-white/10 bg-surface-panel pl-9 dark:bg-surface-panel" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            {authorize(session.role, "customers:edit") ? <Tooltip><TooltipTrigger asChild><Button asChild variant="ghost" size="icon" className="relative"><Link href="/notificacoes"><Bell />{notificationCount > 0 ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" /> : null}<span className="sr-only">Notificações</span></Link></Button></TooltipTrigger><TooltipContent>{notificationCount} notificações não lidas</TooltipContent></Tooltip> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" className="h-10 gap-2 px-2"><Avatar className="size-8"><AvatarFallback className="bg-surface-invert text-[10px] font-semibold text-black">{initials}</AvatarFallback></Avatar><span className="hidden text-left text-xs md:block"><span className="block font-medium">{session.name}</span><span className="block text-[10px] text-muted-foreground">{session.tenantName}</span></span><ChevronDown className="hidden size-3 text-muted-foreground md:block" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56"><DropdownMenuLabel>{session.email}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuGroup><DropdownMenuItem asChild><Link href="/perfil"><UserRound /> Meu perfil</Link></DropdownMenuItem>{authorize(session.role, "settings:edit") ? <DropdownMenuItem asChild><Link href="/configuracoes"><Settings /> Configurações</Link></DropdownMenuItem> : null}</DropdownMenuGroup><DropdownMenuSeparator /><form action="/api/logout" method="post"><DropdownMenuItem asChild><button type="submit" className="w-full"><LogOut /> Sair</button></DropdownMenuItem></form></DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-[1640px] px-4 pb-28 pt-5 sm:px-6 lg:px-7 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-white/15 bg-sidebar p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
        {primaryNavigation.filter((item) => authorize(session.role, item.permission)).slice(0, 4).map((item) => { const Icon = item.icon; return <Button key={item.href} asChild variant="ghost" size="icon"><Link href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={pathname === item.href ? "bg-brand/12 text-brand hover:bg-brand/20 hover:text-brand" : "text-muted-foreground"}><Icon /><span className="sr-only">{item.label}</span></Link></Button>; })}
      </nav>
    </div>
  );
}
