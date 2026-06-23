import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MdOutlinePayment } from "react-icons/md";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  MessageSquare,
  Bot,
  BarChart3,
  Settings,
  Zap,
  ScrollText,
  UsersRound,
  Menu,
  LogOut,
  X,
  Bell,
  CheckCircle,
  Star,
  User,
  History,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { useTranslation } from "@/lib/i18n";
import { LanguageSelector } from "@/components/language-selector";
import { useAuth } from "@/contexts/auth-context";
// import logo from "../../images/logo1924.jpg";
import { GiUpgrade } from "react-icons/gi";
import { RiSecurePaymentFill } from "react-icons/ri";
import { AiOutlineTransaction } from "react-icons/ai";
import { MdOutlineSupportAgent, MdGroups } from "react-icons/md";
import { useSidebar } from "@/contexts/sidebar-context";
import { AdminCreditBox } from "../AdminCreditBox";
import { useQuery } from "@tanstack/react-query";
import { AppSettings } from "@/types/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type Role = "superadmin" | "admin" | "user" | "team";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  badge?: string | number;
  color?: string;
  alwaysVisible?: boolean;
  requiredPrefix?: string;
  allowedRoles?: Role[];
}

function getNavItems(role: string): NavItem[] {
  if (role === "admin") {
    return [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        labelKey: "navigation.dashboard",
        color: "text-green-600",
        alwaysVisible: true,
        allowedRoles: ["superadmin", "admin", "user", "team"],
      },
      {
        href: "/inbox",
        icon: MessageSquare,
        labelKey: "navigation.inbox",
        color: "text-blue-400",
        allowedRoles: ["admin"],
      },
      {
        href: "/contacts",
        icon: Users,
        labelKey: "navigation.contacts",
        color: "text-blue-600",
        allowedRoles: ["superadmin", "admin"],
      },
      {
        href: "/campaigns",
        icon: Megaphone,
        labelKey: "navigation.campaigns",
        color: "text-orange-600",
        allowedRoles: ["superadmin", "admin"],
      },
      {
        href: "/templates",
        icon: FileText,
        labelKey: "navigation.templates",
        color: "text-purple-600",
        allowedRoles: ["superadmin", "admin"],
      },

      {
        href: "/analytics",
        icon: BarChart3,
        labelKey: "navigation.analytics",
        color: "text-pink-600",
        allowedRoles: ["superadmin", "admin"],
      },
      {
        href: "/widget-builder",
        icon: Bot,
        labelKey: "navigation.widgetBuilder",
        color: "text-teal-600",
        alwaysVisible: true,
        allowedRoles: ["superadmin", "user"],
      },
      {
        href: "/message-logs",
        icon: ScrollText,
        labelKey: "navigation.messageLogs",
        color: "text-yellow-600",
        alwaysVisible: true,
        allowedRoles: ["superadmin", "admin"],
      },
      // {
      //   href: "/settings",
      //   icon: Settings,
      //   labelKey: "navigation.settings",
      //   color: "text-gray-600",
      //   alwaysVisible: true,
      //   allowedRoles: ["superadmin", "admin"],
      // },

      {
        href: "/plans",
        icon: Bell,
        labelKey: "navigation.plans",
        color: "text-blue-400",
        allowedRoles: ["superadmin"],
      },
      {
        href: "/gateway",
        icon: Bell,
        labelKey: "navigation.plans",
        color: "text-blue-400",
        allowedRoles: ["superadmin"],
      },
      {
        href: "/support-tickets",
        icon: Bell,
        labelKey: "navigation.tickets_support",
        color: "text-blue-400",
        allowedRoles: ["superadmin"],
      },
    ];
  } else {
    // Team or default role
    return [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        labelKey: "navigation.dashboard",
        color: "text-green-600",
        alwaysVisible: true,
        allowedRoles: ["superadmin", "admin", "user", "team"],
      },
      {
        href: "/inbox",
        icon: MessageSquare,
        labelKey: "navigation.inbox",
        color: "text-blue-400",
        requiredPrefix: "inbox.",
        allowedRoles: ["team"],
      },
      {
        href: "/contacts",
        icon: Users,
        labelKey: "navigation.contacts",
        color: "text-blue-600",
        requiredPrefix: "contacts.",
        allowedRoles: ["team"],
      },
      {
        href: "/groups",
        icon: MdGroups,
        labelKey: "Groups",
        color: "text-blue-400",
        requiredPrefix: "groups.",
        allowedRoles: ["team"],
      },
      {
        href: "/campaigns",
        icon: Megaphone,
        labelKey: "navigation.campaigns",
        color: "text-orange-600",
        requiredPrefix: "campaigns.",
        allowedRoles: ["team"],
      },
      {
        href: "/templates",
        icon: FileText,
        labelKey: "navigation.templates",
        color: "text-purple-600",
        requiredPrefix: "templates.",
        allowedRoles: ["team"],
      },

      {
        href: "/automation",
        icon: Zap,
        labelKey: "navigation.automations",
        color: "text-indigo-600",
        requiredPrefix: "automations.",
        allowedRoles: ["team"],
      },
      {
        href: "/analytics",
        icon: BarChart3,
        labelKey: "navigation.analytics",
        color: "text-pink-600",
        requiredPrefix: "analytics.",
        allowedRoles: ["team"],
      },
      {
        href: "/widget-builder",
        icon: Bot,
        labelKey: "navigation.widgetBuilder",
        color: "text-teal-600",
        alwaysVisible: true,
        requiredPrefix: "widgetbuilder.",
        allowedRoles: ["team"],
      },
      {
        href: "/message-logs",
        icon: ScrollText,
        labelKey: "navigation.messageLogs",
        color: "text-yellow-600",
        alwaysVisible: true,
        allowedRoles: ["team"],
      },
      {
        href: "/team",
        icon: UsersRound,
        labelKey: "Team",
        color: "text-teal-600",
        requiredPrefix: "team.",
        allowedRoles: ["team"],
      },
      // {
      //   href: "/settings",
      //   icon: Settings,
      //   labelKey: "navigation.settings",
      //   color: "text-gray-600",
      //   alwaysVisible: true,
      //   requiredPrefix: "settings.",
      //   allowedRoles: ["team"],
      // },

      {
        href: "/plans",
        icon: Bell,
        labelKey: "navigation.plans",
        color: "text-blue-400",
        requiredPrefix: "plans.",
        allowedRoles: ["team"],
      },
      {
        href: "/gateway",
        icon: Bell,
        labelKey: "navigation.plans",
        color: "text-blue-400",
        requiredPrefix: "gateway.",
        allowedRoles: ["team"],
      },
      {
        href: "/user-support-tickets",
        icon: MdOutlineSupportAgent,
        labelKey: "Tickets Support",
        requiredPrefix: "supporttickets.",
        color: "text-blue-400",
        allowedRoles: ["team"],
      },
      {
        href: "/plan-upgrade",
        icon: GiUpgrade,
        labelKey: "navigation.plan-upgrade",
        requiredPrefix: "planupgrade.",
        color: "text-blue-400",
        allowedRoles: ["admin"],
      },
    ];
  }
}

const sidebarItemsCategories = [
  {
    name: "navigation.dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    color: "text-green-600",
  },
  {
    name: "navigation.users",
    icon: Users,
    path: "/users",
    color: "text-green-600",
  },
  {
    name: "navigation.master_campaigns",
    icon: Megaphone,
    path: "/campaigns",
    badge: "",
    color: "text-blue-600",
  },
  {
    name: "navigation.master_templates",
    icon: FileText,
    path: "/templates",
    badge: "",
    color: "text-purple-600",
  },
  {
    name: "navigation.master_contacts",
    icon: Users,
    path: "/contacts-management",
    badge: "",
    color: "text-yellow-600",
  },
  {
    name: "navigation.analytics",
    icon: BarChart3,
    path: "/analytics",
    color: "text-teal-500",
  },
  {
    name: "navigation.notifications",
    icon: Bell,
    path: "/notifications",
    color: "text-pink-400",
  },
  {
    name: "navigation.messageLogs",
    icon: ScrollText,
    path: "/message-logs",
    color: "text-yellow-600",
  },
];

// Category-based structure for superadmin

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isSuper = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const { toast } = useToast();
  const gatewayMode = typeof window !== "undefined" ? localStorage.getItem("gateway_mode") || "webhook" : "webhook";

  const getScanNavItems = (role: string) => {
    if (role === "superadmin") {
      return [
        { href: "/scan-whatsapp/dashboard", icon: LayoutDashboard, labelKey: "Dashboard", color: "text-green-600" },
        { href: "/users", icon: Users, labelKey: "Users", color: "text-blue-600" },
        { href: "/scan-whatsapp/campaigns", icon: Megaphone, labelKey: "Master Campaign", color: "text-orange-600" },
        { href: "/scan-whatsapp/templates", icon: FileText, labelKey: "Master Template", color: "text-purple-600" },
        { href: "/scan-whatsapp/contacts", icon: UsersRound, labelKey: "Master Contacts", color: "text-yellow-600" },
        { href: "/notifications", icon: Bell, labelKey: "Notifications", color: "text-pink-600" },
        { href: "/scan-whatsapp/auto-replies", icon: MessageSquare, labelKey: "Auto Message Reply", color: "text-indigo-600" },
        { href: "/scan-whatsapp/logs", icon: History, labelKey: "Message Logs", color: "text-gray-600" },
      ];
    }
    return [
      { href: "/scan-whatsapp/dashboard", icon: LayoutDashboard, labelKey: "Dashboard", color: "text-green-600" },
      { href: "/scan-whatsapp/devices", icon: Zap, labelKey: "Add Devices", color: "text-yellow-600" },
      { href: "/scan-whatsapp/inbox", icon: MessageSquare, labelKey: "Inbox", color: "text-blue-400" },
      { href: "/scan-whatsapp/contacts", icon: Users, labelKey: "Contacts", color: "text-blue-600" },
      { href: "/scan-whatsapp/campaigns", icon: Megaphone, labelKey: "Campaign", color: "text-orange-600" },
      { href: "/scan-whatsapp/templates", icon: FileText, labelKey: "Template", color: "text-purple-600" },
      { href: "/scan-whatsapp/auto-replies", icon: MessageSquare, labelKey: "Auto Message Reply", color: "text-indigo-600" },
      { href: "/scan-whatsapp/logs", icon: History, labelKey: "Message Logs", color: "text-gray-600" },
    ];
  };

  const navItems = gatewayMode === "scan" 
    ? getScanNavItems(user?.role || "")
    : getNavItems(user?.role || "");

  const switchGateway = () => {
    localStorage.removeItem("gateway_mode");
    window.location.href = "/select-gateway";
  };

  const { data: brandSettings } = useQuery<AppSettings>({
    queryKey: ["/api/brand-settings"],
    queryFn: () => fetch("/api/brand-settings").then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });

  const {
    isOpen,
    toggle,
    close,
    open,
    isCollapsed,
    selectedMenu,
    setCollapsed,
    setSelectedMenu,
  } = useSidebar();

  console.log("isOpen", isOpen);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setCollapsed(true);
      } else {
        // Mobile pe sidebar automatically collapse na ho, agar open hai tabhi setCollapsed(false)
        if (isOpen) setCollapsed(false);
      }
    };

    handleResize(); // Initial check on mount

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, setCollapsed]); // isOpen dependency add karo taaki resize pe updated value mile
  const canView = (item: NavItem): boolean => {
    if (!user) return false;

    const role = user.role as Role;

    // SUPERADMIN sees everything
    if (role === "superadmin") return true;

    // TEAM role must ONLY use permissions — but allow alwaysVisible items
    if (role === "team") {
      // allow items with no requiredPrefix if they are alwaysVisible
      if (!item.requiredPrefix) {
        return item.alwaysVisible === true;
      }

      if (!user.permissions) return false;

      const perms = Array.isArray(user.permissions)
        ? user.permissions
        : Object.keys(user.permissions);

      const normalize = (str: string) => str.replace(".", ":");

      return perms.some((perm) =>
        perm.startsWith(normalize(item.requiredPrefix!))
      );
    }

    // ---- ADMIN / USER LOGIC ----
    if (item.allowedRoles && !item.allowedRoles.includes(role)) {
      return false;
    }

    if (item.alwaysVisible) return true;

    if (!item.requiredPrefix) return true;

    if (!user.permissions) return false;

    const perms = Array.isArray(user.permissions)
      ? user.permissions
      : Object.keys(user.permissions);

    const normalize = (str: string) => str.replace(".", ":");

    return perms.some((perm) =>
      perm.startsWith(normalize(item.requiredPrefix!))
    );
  };

  const canViewOld = (item: NavItem): boolean => {
    if (!user) return false;
    if (item.allowedRoles && !item.allowedRoles.includes(user.role as Role)) {
      return false;
    }
    if (user.role === "superadmin") {
      return true;
    }

    // --- TEAM ROLE custom permission-based ---
    if (user.role === "team") {
      if (!user.permissions) return false;

      // requiredPrefix must match permission
      if (!item.requiredPrefix) return false;

      const perms = Array.isArray(user.permissions)
        ? user.permissions
        : Object.keys(user.permissions);

      const normalize = (str: string) => str.replace(".", ":");

      return perms.some((perm) =>
        perm.startsWith(normalize(item.requiredPrefix!))
      );
    }
    if (item.alwaysVisible) {
      return true;
    }
    if (!item.requiredPrefix) {
      return true;
    }
    if (!user.permissions) {
      return false;
    }
    const perms = Array.isArray(user.permissions)
      ? user.permissions
      : Object.keys(user.permissions);
    const normalize = (str: string) => str.replace(".", ":");
    return perms.some((perm) =>
      perm.startsWith(normalize(item.requiredPrefix!))
    );
  };

  const renderLink = (
    name: string,
    Icon: React.ComponentType<{ className?: string }>,
    path: string,
    badge?: string | number,
    colorClass?: string
  ) => {
    const isActive = location === path;
    return (
      <Link
        key={path}
        href={path}
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group",
          isActive
            ? "bg-green-50 text-green-700 border-l-4 border-green-600"
            : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
        )}
        onClick={toggle}
      >
        <Icon
          className={cn(
            "w-5 h-5 mr-3",
            isActive ? "text-green-600" : colorClass
          )}
        />

        {name}
        {badge && (
          <span className="ml-auto bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const {
    data: aiData,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["/api/ai-settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai-settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  // Extract dynamic active status
  const aiSettings = aiData?.length ? aiData[0] : null;
  const isAIActive = aiSettings?.isActive ?? false;

  const handleToggleAI = async () => {
    // if (!aiSettings) return;
    if (!aiSettings) {
      toast({
        title: "No settings found",
        description: "Please add AI settings.",
        variant: "destructive",
      });
      return;
    }

    const updatedValue = !isAIActive;

    try {
      const res = await fetch(`/api/ai-settings/${aiSettings.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: updatedValue }), // update only isActive
      });

      if (!res.ok) throw new Error();

      toast({
        title: "Updated",
        description: "AI status updated successfully.",
      });

      refetch();
    } catch {
      toast({
        title: "Error",
        description: "Unable to update AI status.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggle}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg border-r border-gray-100 transform transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <Link
              href="/dashboard"
              className="flex items-center flex-col space-x-2 sm:space-x-3"
            >
              {brandSettings?.logo ? (
                <img
                  src={brandSettings?.logo}
                  alt="Logo"
                  className=" h-10 object-contain"
                />
              ) : (
                <div className="bg-green-800 text-primary-foreground rounded-full p-3">
                  <MessageSquare className="h-8 w-8" />
                </div>
              )}
              <span className=" text-[10px] sm:text-xs pl-8">
                Building amazing experiences
              </span>
            </Link>
            <button
              onClick={toggle}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {isAdmin || user?.role == "team" ? (
            <div className="px-6 py-3 border-b border-gray-100">
              <ChannelSwitcher />
            </div>
          ) : (
            ""
          )}

          <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
            {gatewayMode === "webhook" && isSuper
              ? sidebarItemsCategories.map((item) =>
                renderLink(
                  t(item.name),
                  item.icon,
                  item.path,
                  item.badge,
                  item.color
                )
              )
              : navItems
                .filter(canView)
                .map((item: any) =>
                  renderLink(
                    item.labelKey.includes(".") ? t(item.labelKey) : item.labelKey,
                    item.icon,
                    item.href,
                    item.badge,
                    item.color
                  )
                )}
          </nav>

          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs border-dashed border-gray-300 text-gray-500 hover:text-green-600 hover:border-green-300"
              onClick={switchGateway}
            >
              <LayoutGrid className="w-3 h-3 mr-2" />
              Switch Gateway
            </Button>
          </div>

          <div className="w-[180px] px-4 py-2 border-t border-gray-100 sm:hidden ">
            <LanguageSelector />
          </div>
          {/* {isAdmin ? (
          ) : (
            ""
          )} */}

          {/* {isAdmin && (
            <div className="px-3 py-2">
              <AdminCreditBox />
            </div>
          )} */}

          {/* Smaller Toggle Button with Green Color */}

          {/* User Profile */}
          <div className="p-2 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center space-x-3 hover:bg-gray-50 rounded-lg p-2 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-600 to-green-500 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user
                        ? (
                          user.firstName?.[0] || user.username[0]
                        ).toUpperCase()
                        : "U"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user
                        ? user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.username
                        : "User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate capitalize">
                      {user?.role || "User"}
                    </p>
                  </div>
                  <Settings className="w-4 h-4 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("common.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t("navigation.settings")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/account" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>{t("navigation.account")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("common.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </>
  );
}
