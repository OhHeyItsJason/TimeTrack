import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Timer, History, FileText, Settings, Receipt, Clock } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Timer",
    url: createPageUrl("Timer"),
    icon: Timer,
  },
  {
    title: "Work History",
    url: createPageUrl("History"),
    icon: History,
  },
  {
    title: "Invoice",
    url: createPageUrl("Invoice"),
    icon: FileText,
  },
  {
    title: "Invoice History",
    url: createPageUrl("InvoiceHistory"),
    icon: Receipt,
  },
  {
    title: "Settings",
    url: createPageUrl("Settings"),
    icon: Settings,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  return (
    <SidebarProvider>
                <style>{`
                  @import url('https://fonts.googleapis.com/css2?family=SF+Pro+Display:wght@300;400;500;600;700&display=swap');

                  :root {
                    --primary: 215 100% 60%;
                    --primary-foreground: 0 0% 100%;
                    --accent: 215 100% 60%;
                    --accent-foreground: 0 0% 100%;
                  }

                  * {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                  }

                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    background: #f2f2f7;
                  }

                  h1, h2, h3, h4, h5, h6 {
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    font-weight: 600;
                  }

                  .ios-blur {
                    backdrop-filter: saturate(180%) blur(20px);
                    -webkit-backdrop-filter: saturate(180%) blur(20px);
                  }

                  .clock-static {
                    transform: rotate(25deg);
                  }
                `}</style>
                <div className="min-h-screen flex w-full bg-[#f2f2f7]">
        <Sidebar className="border-r border-gray-200 hidden md:flex bg-white/80 ios-blur">
                        <SidebarHeader className="border-b border-gray-200 p-6 bg-white/50">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[22px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                              <Clock className="w-6 h-6 text-white clock-static" />
                            </div>
                            <h2 className="text-gray-900 text-xl font-semibold tracking-tight">
                              TimeTrack
                            </h2>
                          </div>
                        </SidebarHeader>
          
          <SidebarContent className="p-3">
                            <SidebarGroup>
                              <SidebarGroupContent>
                                <SidebarMenu>
                                  {navigationItems.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                      <SidebarMenuButton 
                                        asChild 
                                        className={`hover:bg-gray-100 transition-all duration-200 rounded-[14px] mb-1 ${
                                          location.pathname === item.url 
                                            ? 'bg-gray-100 text-blue-600 shadow-sm' 
                                            : 'text-gray-700'
                                        }`}
                                      >
                                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                                          <item.icon className="w-5 h-5" />
                                          <span className="font-medium">{item.title}</span>
                                        </Link>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  ))}
                                </SidebarMenu>
                              </SidebarGroupContent>
                            </SidebarGroup>
                          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
                        <header className="bg-white/80 ios-blur border-b border-gray-200 px-4 py-3 md:hidden sticky top-0 z-50">
                          <div className="flex items-center gap-4">
                            <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-[12px] transition-colors duration-200 text-gray-700" />
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-[18px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Clock className="w-5 h-5 text-white clock-static" />
                              </div>
                              <h1 className="text-lg text-gray-900 font-semibold">TimeTrack</h1>
                            </div>
                          </div>
                        </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Mobile Bottom Navigation */}
                          <nav className="md:hidden bg-white/90 ios-blur border-t border-gray-200 sticky bottom-0 z-50 safe-area-inset-bottom">
                            <div className="flex items-center justify-around px-2 py-1">
                              {navigationItems.map((item) => (
                                <Link
                                  key={item.title}
                                  to={item.url}
                                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-[12px] transition-all duration-200 ${
                                    location.pathname === item.url
                                      ? 'text-blue-600'
                                      : 'text-gray-500'
                                  }`}
                                >
                                  <item.icon className="w-6 h-6" strokeWidth={location.pathname === item.url ? 2.5 : 2} />
                                  <span className="text-[10px] font-medium">{item.title}</span>
                                </Link>
                              ))}
                            </div>
                          </nav>
        </main>
      </div>
    </SidebarProvider>
  );
}