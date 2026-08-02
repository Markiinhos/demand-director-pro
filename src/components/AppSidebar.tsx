import {
  LayoutDashboard, ListTodo, Users, DollarSign, FileText, Briefcase, LogOut,
  Calculator, CalendarDays, Clock, CreditCard, Plug, FileSignature,
  ClipboardList, Crown, MessageCircle, UserCog, Bot
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Assistente IA", url: "/assistente", icon: Bot },
  { title: "Demandas", url: "/demandas", icon: ListTodo },
  { title: "CRM", url: "/clientes", icon: Users },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
  { title: "Prazos", url: "/prazos", icon: Clock },
];

const financeNavItems = [
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Cobranças", url: "/cobrancas", icon: CreditCard },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
];

const toolsNavItems = [
  { title: "Briefings", url: "/briefings", icon: ClipboardList },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
  { title: "Calculadora", url: "/calculadora", icon: Calculator },
];

const integrationNavItems = [
  { title: "Integrações", url: "/integracoes", icon: Plug },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
];

const accountNavItems = [
  { title: "Planos", url: "/planos", icon: Crown },
  { title: "Perfil", url: "/perfil", icon: UserCog },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  const renderNavGroup = (items: typeof mainNavItems, label?: string) => (
    <SidebarGroup>
      {label && !collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-muted/60 font-semibold mb-1">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = item.url === "/" ? location.pathname === "/" : location.pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                  className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary" : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground"}
                >
                  <NavLink to={item.url} end={item.url === "/"}>
                    <item.icon className="h-[18px] w-[18px]" />
                    {!collapsed && <span className="text-[13px]">{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-3">
        {/* Logo */}
        <div className="px-4 mb-4">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow-sm">
                <Briefcase className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-sidebar-accent-foreground tracking-tight">DesignOS</h1>
                <p className="text-[10px] text-sidebar-muted/70 font-medium">Gestão Criativa</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-glow-sm">
                <Briefcase className="h-4.5 w-4.5 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        {renderNavGroup(mainNavItems)}
        {!collapsed && <div className="mx-4 my-1 h-px bg-sidebar-border/50" />}
        {renderNavGroup(financeNavItems, "Financeiro")}
        {!collapsed && <div className="mx-4 my-1 h-px bg-sidebar-border/50" />}
        {renderNavGroup(toolsNavItems, "Ferramentas")}
        {!collapsed && <div className="mx-4 my-1 h-px bg-sidebar-border/50" />}
        {renderNavGroup(integrationNavItems, "Integrações")}
        {!collapsed && <div className="mx-4 my-1 h-px bg-sidebar-border/50" />}
        {renderNavGroup(accountNavItems, "Conta")}

        {/* Logout */}
        <SidebarFooter className="mt-auto">
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 text-[13px] group"
          >
            <LogOut className="h-[18px] w-[18px] group-hover:text-destructive transition-colors" />
            {!collapsed && <span>Sair</span>}
          </button>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
