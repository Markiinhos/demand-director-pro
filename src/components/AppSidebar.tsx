import { LayoutDashboard, ListTodo, Users, DollarSign, FileText, Briefcase, LogOut, Calculator, CalendarDays, Clock, CreditCard, Plug, FileSignature, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Demandas", url: "/demandas", icon: ListTodo },
  { title: "CRM", url: "/clientes", icon: Users },
  { title: "Calendário", url: "/calendario", icon: CalendarDays },
  { title: "Prazos", url: "/prazos", icon: Clock },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Cobranças", url: "/cobrancas", icon: CreditCard },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
  { title: "Briefings", url: "/briefings", icon: ClipboardList },
  { title: "Contratos", url: "/contratos", icon: FileSignature },
  { title: "Calculadora", url: "/calculadora", icon: Calculator },
  { title: "Integrações", url: "/integracoes", icon: Plug },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-4">
        <div className="px-4 mb-6">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-sidebar-accent-foreground">DesignOS</h1>
                <p className="text-[10px] text-sidebar-muted">Gestão Criativa</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-sidebar-primary-foreground" />
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto px-3 pb-4">
          <button onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors text-sm">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
