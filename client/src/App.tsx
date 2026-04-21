import React, { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChannelProvider } from "@/contexts/channel-context";
import { UnreadCountProvider } from "@/contexts/UnreadCountContext";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import Templates from "@/pages/templates";
import Inbox from "@/pages/inbox";
import Automations from "@/pages/automations";
import Analytics from "@/pages/analytics";
import CampaignAnalytics from "@/pages/campaign-analytics";
import Settings from "@/pages/settings";
import Logs from "@/pages/logs";
import Team from "@/pages/team";
import Sidebar from "@/components/layout/sidebar";
import Account from "./pages/account";
import { AppLayout } from "./components/layout/AppLayout";
import ChatbotBuilder from "./pages/chatbot-builder";
import AddChatbotBuilder from "./pages/add-chatbot-builder";
import WidgetBuilder from "./pages/widget-builder";
import Websites from "./pages/websites";
import Home from "./pages/Home";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Signup from "./pages/Signup";
import LoadingAnimation from "./components/LoadingAnimation";
import Plans from "./pages/plans";
import GatewaySettings from "./pages/GatewaySettings";
import BotFlowBuilder from "./pages/BotFlowBuilder";
import Workflows from "./pages/Workflows";
import AIAssistant from "./pages/AIAssistant";
import AutoResponses from "./pages/AutoResponses";
import WABAConnection from "./pages/WABAConnection";
import MultiNumber from "./pages/MultiNumbert";
import Webhooks from "./pages/Webhooks";
import QRCodes from "./pages/QRCodes";
import CRMSystem from "./pages/CRMSystem";
import LeadManagement from "./pages/LeadManagement";
import BulkImport from "./pages/BulkImport";
import Segmentation from "./pages/Segmentation";
import HealthMonitor from "./pages/HealthMonitor";
import Reports from "./pages/Reports";
import Notifications from "./pages/Notifications";
import ChatHub from "./pages/ChatHub";
import User from "./pages/users";
import TransactionsPage from "./pages/transactions-page";
import ContactsManagements from "./pages/contacts-managements";
import SupportTicketsNew from "./pages/support-tickets";
import userDetails from "./pages/userDetails";
import UserSupportTicketsNew from "./pages/user-support-tickets";
import BillingSubscriptionPage from "./components/billing-subscription-page";
import GroupsUI from "./pages/group-list";
import AllSubscriptionsPage from "./pages/masterSubscriptions";
import DemoPage from "./pages/DemoPage";
import MinimalLoader from "./components/MinimalLoader";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import VerifyEmail from "./pages/verify-email";
import AboutUs from "./pages/AboutUs";
import { ScrollToTop } from "./components/ScrollToTop";
import Integrations from "./components/Integrations";
import PressKit from "./components/PressKit";
import CaseStudies from "./components/CaseStudies";
import WhatsAppGuide from "./components/WhatsAppGuide";
import BestPractices from "./components/BestPractices";
import CookiePolicy from "./components/CookiePolicy";
import ContactusLanding from "./components/ContactusLanding";
import { SignupPopupHandler } from "./components/SignupPopupHandler";
import Careers from "./components/Careers";
import SelectGateway from "./pages/SelectGateway";
import DevicesPage from "./pages/scan-whatsapp/Devices";
import ScanTemplates from "./pages/scan-whatsapp/Templates";
import ScanContacts from "./pages/scan-whatsapp/Contacts";

// Define route permissions mapping
const ROUTE_PERMISSIONS: Record<string, string> = {
  "/contacts": "contacts.view",
  "/campaigns": "campaigns.view",
  "/templates": "templates.view",
  "/inbox": "inbox.view",
  "/team": "team.view",
  "/automation": "automations.view",
  "/analytics": "analytics.view",
  // "/analytics/campaign/:campaignId": "analytics.view",
  "/logs": "logs.view",
  "/settings": "settings.view",
  "/account": "",
  "/bot-builder": "",
};

function UnauthorizedPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600">
          You don't have permission to access this page.
        </p>
      </div>
    </div>
  );
}

// Permission wrapper component
function PermissionRoute({
  component: Component,
  requiredPermission,
}: Readonly<{
  component: React.ComponentType;
  requiredPermission?: string;
}>) {
  const { user } = useAuth();

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    if (!user?.permissions) return false;

    const perms = Array.isArray(user.permissions)
      ? user.permissions
      : Object.keys(user.permissions);

    const normalize = (str: string) => str.replace(".", ":");

    return perms.some(
      (perm) =>
        perm.startsWith(normalize(permission)) &&
        (Array.isArray(user.permissions) ? true : user.permissions[perm])
    );
  };

  if (!hasPermission(requiredPermission)) {
    return <UnauthorizedPage />;
  }

  return <Component />;
}

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Check flag immediately on mount - synchronously
  const fromLoginFlag =
    typeof window !== "undefined" &&
    sessionStorage.getItem("fromLogin") === "true";

  const [showLoading, setShowLoading] = useState(fromLoginFlag);
  const [isLoginRedirect] = useState(fromLoginFlag);

  // Clear flag immediately after reading
  useEffect(() => {
    if (fromLoginFlag) {
      sessionStorage.removeItem("fromLogin");
    }
  }, [fromLoginFlag]);

  // Check if gateway mode is selected
  const gatewayMode = typeof window !== "undefined" ? localStorage.getItem("gateway_mode") : null;
  const isSuperOrAdmin = user?.role === "superadmin" || user?.role === "admin";

  // Check if user has access to current route
  useEffect(() => {
    if (isAuthenticated && user) {
      // Force gateway selection for admins if not picked
      if (isSuperOrAdmin && !gatewayMode && location !== "/select-gateway") {
        setLocation("/select-gateway");
        return;
      }

      if (location !== "/" && location !== "/select-gateway") {
        const requiredPermission = ROUTE_PERMISSIONS[location];
        if (requiredPermission && !hasRoutePermission(requiredPermission, user)) {
          setLocation("/dashboard");
        }
      }
    }
  }, [location, isAuthenticated, user, setLocation, gatewayMode, isSuperOrAdmin]);

  // Priority 1: Show login animation loader immediately
  if (showLoading && isLoginRedirect) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]">
        <LoadingAnimation onComplete={() => setShowLoading(false)} />
      </div>
    );
  }

  // Priority 2: Show minimal loader during auth check
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-[9999]">
        <MinimalLoader onComplete={() => { }} duration={1500} color="green" />
      </div>
    );
  }

  // Priority 3: Not authenticated - show public routes
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/signup">
          <LoginPage />
        </Route>
        <Route path="/verify-email" component={VerifyEmail} />
        {/* Redirect any other public route to login if not authenticated */}
        <Route path="/:rest*" component={LoginPage} />
      </Switch>
    );
  }

  // Priority 4: Authenticated - show dashboard and protected routes
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 lg:ml-64">
        <Switch>
          <Route path="/dashboard">
            <Dashboard />
          </Route>
          <Route path="/contacts">
            <PermissionRoute
              component={Contacts}
              requiredPermission="contacts:view"
            />
          </Route>
          <Route path="/users">
            <PermissionRoute component={User} />
          </Route>
          <Route path="/users/:id" component={userDetails} />
          <Route path="/campaigns">
            <PermissionRoute
              component={Campaigns}
              requiredPermission="campaigns:view"
            />
          </Route>
          <Route path="/templates">
            <PermissionRoute
              component={Templates}
              requiredPermission="templates:view"
            />
          </Route>
          <Route path="/inbox">
            <PermissionRoute
              component={Inbox}
              requiredPermission="inbox:view"
            />
          </Route>
          <Route path="/plans">
            <PermissionRoute component={Plans} />
          </Route>
          <Route path="/gateway">
            <PermissionRoute component={GatewaySettings} />
          </Route>
          <Route path="/team">
            <PermissionRoute component={Team} requiredPermission="team:view" />
          </Route>
          <Route path="/automation">
            <PermissionRoute
              component={Automations}
              requiredPermission="automations:view"
            />
          </Route>
          <Route path="/analytics">
            <PermissionRoute component={Analytics} />
          </Route>
          <Route path="/websites">
            <PermissionRoute component={Websites} />
          </Route>
          <Route path="/add/chatbot-builder">
            <PermissionRoute component={AddChatbotBuilder} />
          </Route>
          <Route path="/widget-builder">
            <PermissionRoute component={WidgetBuilder} />
          </Route>
          <Route path="/chatbot-builder">
            <PermissionRoute component={ChatbotBuilder} />
          </Route>
          <Route path="/settings">
            <PermissionRoute
              component={Settings}
              requiredPermission="settings:view"
            />
          </Route>
          <Route path="/analytics/campaign/:campaignId">
            <PermissionRoute
              component={CampaignAnalytics}
            // requiredPermission="settings:view"
            />
          </Route>
          <Route path="/account">
            <PermissionRoute component={Account} />
          </Route>
          <Route path="/bot-builder">
            <PermissionRoute component={BotFlowBuilder} />
          </Route>
          <Route path="/workflows">
            <PermissionRoute component={Workflows} />
          </Route>
          <Route path="/ai-assistant">
            <PermissionRoute component={AIAssistant} />
          </Route>
          <Route path="/auto-responses">
            <PermissionRoute component={AutoResponses} />
          </Route>
          <Route path="/waba-connection">
            <PermissionRoute component={WABAConnection} />
          </Route>
          <Route path="/multi-number">
            <PermissionRoute component={MultiNumber} />
          </Route>
          <Route path="/webhooks">
            <PermissionRoute component={Webhooks} />
          </Route>
          <Route path="/qr-codes">
            <PermissionRoute component={QRCodes} />
          </Route>
          <Route path="/crm-systems">
            <PermissionRoute component={CRMSystem} />
          </Route>
          <Route path="/leads">
            <PermissionRoute component={LeadManagement} />
          </Route>
          <Route path="/bulk-import">
            <PermissionRoute component={BulkImport} />
          </Route>
          <Route path="/segmentation">
            <PermissionRoute component={Segmentation} />
          </Route>
          <Route path="/message-logs">
            <PermissionRoute component={Logs} />
          </Route>
          <Route path="/health-monitor">
            <PermissionRoute component={HealthMonitor} />
          </Route>
          <Route path="/reports">
            <PermissionRoute component={Reports} />
          </Route>
          <Route path="/transactions-logs">
            <PermissionRoute component={TransactionsPage} />
          </Route>
          <Route path="/contacts-management">
            <PermissionRoute component={ContactsManagements} />
          </Route>
          <Route path="/support-tickets">
            <PermissionRoute component={SupportTicketsNew} />
          </Route>
          <Route path="/groups">
            <PermissionRoute component={GroupsUI} />
          </Route>
          <Route path="/user-support-tickets">
            <PermissionRoute component={UserSupportTicketsNew} />
          </Route>
          <Route path="/plan-upgrade">
            <PermissionRoute component={Plans} />
          </Route>
          <Route path="/billing">
            <PermissionRoute component={BillingSubscriptionPage} />
          </Route>
          <Route path="/notifications">
            <PermissionRoute component={Notifications} />
          </Route>
          <Route path="/chat-hub">
            <PermissionRoute component={ChatHub} />
          </Route>
          <Route path="/scan-whatsapp/devices">
            <PermissionRoute component={DevicesPage} />
          </Route>
          <Route path="/scan-whatsapp/templates">
            <PermissionRoute component={ScanTemplates} />
          </Route>
          <Route path="/scan-whatsapp/contacts">
            <PermissionRoute component={ScanContacts} />
          </Route>
          
          {/* Catch-all for other scan routes not yet implemented */}
          <Route path="/scan-whatsapp/:rest*">
            <div className="flex items-center justify-center min-h-[80vh]">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Scan WhatsApp <span className="text-blue-600">Gateway</span></h2>
                <div className="p-12 bg-blue-50 rounded-3xl border-2 border-blue-100 shadow-inner inline-block">
                  <QrCode className="w-24 h-24 text-blue-600 animate-pulse" />
                </div>
                <p className="text-slate-600 text-lg">This feature is currently <span className="font-semibold text-indigo-600 italic underline decoration-wavy decoration-indigo-300">Working On It...</span></p>
                <Button 
                  onClick={() => {
                    localStorage.setItem("gateway_mode", "webhook");
                    window.location.href = "/dashboard";
                  }}
                  variant="outline"
                  className="mt-6"
                >
                  Return to Webhook Gateway
                </Button>
              </div>
            </div>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

// Helper function to check route permissions
function hasRoutePermission(permission: string, user: any) {
  if (!user?.permissions) return false;

  const perms = Array.isArray(user.permissions)
    ? user.permissions
    : Object.keys(user.permissions);

  const normalize = (str: string) => str.replace(".", ":");

  return perms.some(
    (perm: string) =>
      perm.startsWith(normalize(permission)) &&
      (Array.isArray(user.permissions) ? true : user.permissions[perm])
  );
}

// Custom hook for permission checking
export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (permission: string) => {
    if (!user?.permissions) return false;

    const perms = Array.isArray(user.permissions)
      ? user.permissions
      : Object.keys(user.permissions);

    const normalize = (str: string) => str.replace(".", ":");
    const normalizedPermission = normalize(permission);

    return perms.some(
      (perm) =>
        perm.startsWith(normalizedPermission) &&
        (Array.isArray(user.permissions) ? true : user.permissions[perm])
    );
  };

  const canAccessRoute = (route: string) => {
    const requiredPermission = ROUTE_PERMISSIONS[route];
    return requiredPermission ? hasPermission(requiredPermission) : true;
  };

  return { hasPermission, canAccessRoute, user };
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <SignupPopupHandler />
      <Switch>
        <Route path="/demo">
          <>
            <DemoPage />
          </>
        </Route>
        <Route path="/login" component={LoginPage} />
        <Route path="/verify-email">
          <>
            <Header />
            <VerifyEmail />
            <Footer />
          </>
        </Route>
        <Route path="/signup">
          <LoginPage />
        </Route>
        <Route path="/privacy-policy">
          <>
            <Header />
            <PrivacyPage />
            <Footer />
          </>
        </Route>
        <Route path="/terms">
          <>
            <Header />
            <TermsPage />
            <Footer />
          </>
        </Route>
        <Route path="/about">
          <>
            <Header />
            <AboutUs />
            <Footer />
          </>
        </Route>
        <Route path="/integrations">
          <>
            <Header />
            <Integrations />
            <Footer />
          </>
        </Route>
        <Route path="/press-kit">
          <>
            <Header />
            <PressKit />
            <Footer />
          </>
        </Route>
        <Route path="/case-studies">
          <>
            <Header />
            <CaseStudies />
            <Footer />
          </>
        </Route>
        <Route path="/whatsapp-guide">
          <>
            <Header />
            <WhatsAppGuide />
            <Footer />
          </>
        </Route>
        <Route path="/best-practices">
          <>
            <Header />
            <BestPractices />
            <Footer />
          </>
        </Route>
        <Route path="/cookie-policy">
          <>
            <Header />
            <CookiePolicy />
            <Footer />
          </>
        </Route>
        <Route path="/contact">
          <>
            <Header />
            <ContactusLanding />
            <Footer />
          </>
        </Route>
        <Route path="/careers">
          <>
            <Header />
            <Careers />
            <Footer />
          </>
        </Route>
        <Route path="/select-gateway">
          <SelectGateway />
        </Route>
        <Route path="/">
          <LoginPage />
        </Route>
        <Route component={ProtectedRoutes} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <AuthProvider>
          <ChannelProvider>
            <TooltipProvider>
              <UnreadCountProvider>
                <Toaster />
                <Router />
              </UnreadCountProvider>
            </TooltipProvider>
          </ChannelProvider>
        </AuthProvider>
      </AppLayout>
    </QueryClientProvider>
  );
}

export default App;
