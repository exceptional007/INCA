import React from "react"
import { Outlet, useLocation, Link } from "react-router-dom"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"
import { useAuth } from "@/context/AuthContext"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { LayoutGrid, Building2, LogOut, User as UserIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface BreadcrumbEntry {
  label: string
  url?: string
  isCurrent?: boolean
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const role = user?.role?.code

  // Determine breadcrumb labels based on pathname
  const getBreadcrumbs = (): BreadcrumbEntry[] => {
    const path = location.pathname
    if (path === "/dashboard") {
      return [{ label: "Dashboard", isCurrent: true }]
    }
    if (path === "/schedules") {
      return [{ label: "Timetables & Schedules", isCurrent: true }]
    }
    if (path === "/academic") {
      return [{ label: "Academic Master", isCurrent: true }]
    }
    if (path.startsWith("/academic/timetable-imports")) {
      return [
        { label: "Academic Master", url: "/academic" },
        { label: "Timetable PDF Import", isCurrent: true },
      ]
    }
    if (path.startsWith("/attendance")) {
      return [
        { label: "Campus Operations" },
        { label: "Take Attendance", isCurrent: true },
      ]
    }
    if (path === "/activities") {
      return [{ label: "Campus Activities", isCurrent: true }]
    }
    if (path === "/reports") {
      return [{ label: "Reports & Analytics", isCurrent: true }]
    }
    return [{ label: "INCA Portal", isCurrent: true }]
  }

  const breadcrumbs = getBreadcrumbs()

  const getRoleBadgeVariant = (roleCode?: string) => {
    switch (roleCode) {
      case "SUPER_ADMIN":
        return "destructive"
      case "ADMIN":
        return "warning"
      case "HOD":
        return "purple"
      case "COORDINATOR":
        return "info"
      case "FACULTY":
        return "default"
      case "STUDENT":
        return "success"
      default:
        return "secondary"
    }
  }

  const departmentName =
    (user as any)?.adminProfile?.department?.shortName ||
    (user as any)?.adminProfile?.department?.code ||
    (user as any)?.facultyProfile?.department?.shortName ||
    (user as any)?.departmentName ||
    null

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background flex flex-col min-w-0 min-h-screen">
        {/* Institutional Application Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 sm:px-6 bg-card/95 backdrop-blur-md z-10 sticky top-0 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <SidebarTrigger className="-ml-1 h-8 w-8 rounded-lg hover:bg-muted" />

            <div className="h-4 w-px bg-border/80 hidden sm:block" />

            {/* Breadcrumb Hierarchy */}
            <Breadcrumb className="hidden sm:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/hub" className="text-muted-foreground hover:text-foreground">
                      Home
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                {breadcrumbs.map((bc, idx) => (
                  <React.Fragment key={idx}>
                    <BreadcrumbItem>
                      {bc.isCurrent ? (
                        <BreadcrumbPage>{bc.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={bc.url || "#"}>{bc.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {idx < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Right Header Scope & Profile Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {departmentName && (
              <Badge variant="outline" className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium border-border/80 bg-muted/30">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{departmentName}</span>
              </Badge>
            )}

            <Badge variant={getRoleBadgeVariant(role)} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
              {role?.replace("_", " ") || "USER"}
            </Badge>

            <Link
              to="/hub"
              title="Switch Module / Hub"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer flex items-center justify-center"
              aria-label="Feature Hub"
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </Link>

            {/* Header User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="User profile and settings"
                >
                  <Avatar className="h-8 w-8 border border-border shadow-2xs hover:opacity-90 transition-opacity">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                      {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-xl p-1.5 shadow-lg border border-border"
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-semibold leading-none text-foreground truncate">{user?.email}</p>
                    <p className="text-[10px] leading-none text-muted-foreground font-medium">{role}</p>
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
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 w-full min-w-0">
          <div className="max-w-7xl mx-auto w-full min-w-0 space-y-5">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
