import { NavLink, Link } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Sparkles,
  CheckSquare,
  BarChart3,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Upload,
  LayoutGrid,
  Store,
  SearchCheck,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface NavEntry {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

interface NavSection {
  title: string
  roles?: string[]
  items: NavEntry[]
}

export function AppSidebar() {
  const { user, logout } = useAuth()
  const role = user?.role?.code
  const { state } = useSidebar()

  const navigationSections: NavSection[] = [
    {
      title: "Core Portal",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
        {
          title: "Timetables & Schedules",
          url: "/schedules",
          icon: Calendar,
          roles: ["SUPER_ADMIN", "ADMIN", "HOD", "COORDINATOR", "FACULTY", "STUDENT"],
        },
        {
          title: "AI Notes & Tutor",
          url: "/notes",
          icon: Sparkles,
          roles: ["SUPER_ADMIN", "ADMIN", "HOD", "COORDINATOR", "FACULTY", "STUDENT"],
        },
        {
          title: "Campus Marketplace",
          url: "/marketplace",
          icon: Store,
          roles: ["SUPER_ADMIN", "ADMIN", "HOD", "COORDINATOR", "FACULTY", "STUDENT"],
        },
        {
          title: "AI Lost & Found",
          url: "/lost-found",
          icon: SearchCheck,
          roles: ["SUPER_ADMIN", "ADMIN", "HOD", "COORDINATOR", "FACULTY", "STUDENT"],
        },
      ],
    },
    {
      title: "Academic Administration",
      roles: ["SUPER_ADMIN", "ADMIN", "HOD"],
      items: [
        {
          title: "Academic Master",
          url: "/academic",
          icon: Building2,
          roles: ["SUPER_ADMIN", "ADMIN", "HOD"],
        },
        {
          title: "Timetable PDF Import",
          url: "/academic/timetable-imports",
          icon: Upload,
          roles: ["ADMIN", "HOD"],
        },
      ],
    },
    {
      title: "Campus Operations",
      items: [
        {
          title: "Take Attendance",
          url: "/attendance/mark",
          icon: CheckSquare,
          roles: ["ADMIN", "HOD", "COORDINATOR", "FACULTY"],
        },
        {
          title: "Campus Activities",
          url: "/activities",
          icon: Sparkles,
        },
      ],
    },
    {
      title: "Intelligence & Insights",
      items: [
        {
          title: "Reports & Analytics",
          url: "/reports",
          icon: BarChart3,
        },
      ],
    },
  ]

  const filteredGroups = navigationSections
    .filter((group) => !group.roles || (role && group.roles.includes(role)))
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (role && item.roles.includes(role))
      ),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80 bg-card">
      <SidebarHeader className={cn(
        "h-16 flex border-b border-border/80 bg-card transition-all",
        state === "expanded" ? "justify-center px-4" : "justify-center items-center px-0"
      )}>
        <Link
          to="/hub"
          title="Return to Feature Hub"
          className={cn(
            "flex items-center overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg",
            state === "expanded" ? "gap-2.5 w-full" : "justify-center w-full"
          )}
        >
          <div className="flex aspect-square size-8.5 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0 shadow-xs group-hover:scale-105 transition-transform">
            <ShieldCheck className="size-4.5" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col leading-none min-w-0">
              <span className="font-bold text-foreground text-sm tracking-tight flex items-center gap-1.5">
                INCA
                <span className="text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-full bg-primary/10">
                  ASSAM
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">
                Campus Automation
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="bg-card px-2 py-3">
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.title} className="py-1">
            <SidebarGroupLabel className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-widest px-2 mb-1">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isActive
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/80 p-2 bg-card">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-xl"
                  aria-label="User account menu"
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-border">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                      {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
                    <span className="truncate font-semibold text-foreground">{user?.email?.split('@')[0]}</span>
                    <span className="truncate text-[10px] text-muted-foreground font-medium">{role || 'User'}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-60 rounded-xl p-1.5 shadow-lg border border-border"
                side="bottom"
                align="end"
                sideOffset={6}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-2.5 text-left text-xs">
                    <Avatar className="h-8 w-8 rounded-lg border border-border shrink-0">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold">
                        {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-xs leading-tight min-w-0">
                      <span className="truncate font-semibold text-foreground">{user?.email}</span>
                      <span className="truncate text-[10px] text-primary font-medium">{role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/hub" className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-1.5 rounded-lg">
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                    Feature Hub
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive text-xs flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
