import { Outlet } from "react-router-dom"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./AppSidebar"

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-background z-10 sticky top-0">
          <SidebarTrigger className="-ml-1" />
          <div className="w-full flex justify-between items-center">
            {/* We could add Breadcrumbs here later if needed */}
            <div className="font-medium text-sm text-muted-foreground ml-2">
              Welcome to INCA Assistant
            </div>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
