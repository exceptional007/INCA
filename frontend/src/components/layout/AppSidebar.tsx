import { NavLink } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
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
  Clock,
  Sparkles,
  CheckSquare,
  BarChart3,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  Upload,
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

export function AppSidebar() {
  const { user, logout } = useAuth()
  const role = user?.role?.code
  const { state } = useSidebar()

  const navItems = [
    {
      title: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: "Management",
      roles: ["SUPER_ADMIN", "ADMIN", "HOD"],
      items: [
        {
          title: "Academic Master",
          url: "/academic",
          icon: Building2,
        },
        {
          title: "Timetables & Schedules",
          url: "/schedules",
          icon: Calendar,
        },
        {
          title: "Timetable PDF Import",
          url: "/academic/timetable-imports",
          icon: Upload,
        },
      ],
    },
    {
      title: "Classes",
      roles: ["FACULTY", "STUDENT"],
      items: [
        {
          title: "Today's Schedule",
          url: "/today-schedule",
          icon: Clock,
        },
      ],
    },
    {
      title: "Activities & Events",
      items: [
        {
          title: "Activities",
          url: "/activities",
          icon: Sparkles,
        },
      ],
    },
    {
      title: "Attendance",
      roles: ["SUPER_ADMIN", "ADMIN", "HOD", "FACULTY", "COORDINATOR"],
      items: [
        {
          title: "Take Attendance",
          url: "/attendance/mark",
          icon: CheckSquare,
        },
      ],
    },
    {
      title: "Analytics",
      items: [
        {
          title: "Reports & Analytics",
          url: "/reports",
          icon: BarChart3,
        },
      ],
    },
  ]

  const filteredGroups = navItems.filter(
    (group) => !group.roles || (role && group.roles.includes(role))
  )

  return (
    <Sidebar collapsible="icon" className="border-r border-[#e0e0e0] bg-white">
      <SidebarHeader className="h-16 flex justify-center border-b border-[#e0e0e0] px-4 bg-white">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-action-blue text-white shrink-0">
            <ShieldCheck className="size-4.5" />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col leading-none">
              <span className="font-semibold text-ink text-[14px] tracking-tight">INCA</span>
              <span className="text-[9px] text-action-blue font-bold uppercase tracking-wider mt-0.5">
                Campus Automation
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-white">
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[10px] uppercase font-bold text-ink-muted-48 tracking-widest px-2">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        className={({ isActive }) =>
                          isActive
                            ? "bg-secondary font-semibold text-action-blue flex items-center gap-2 px-3 py-2 w-full rounded-[8px]"
                            : "text-[#86868b] hover:text-ink hover:bg-canvas-parchment/60 flex items-center gap-2 px-3 py-2 w-full rounded-[8px] transition-colors"
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg border">
                    <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
                      {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.email?.split('@')[0]}</span>
                    <span className="truncate text-xs text-muted-foreground">{role || 'User'}</span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg border">
                      <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
                        {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.email}</span>
                      <span className="truncate text-xs text-muted-foreground">{role}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
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
