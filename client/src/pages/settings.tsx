import { useState, useEffect } from "react";
import Header from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Smartphone,
  Webhook,
  SettingsIcon,
  Database,
  BotIcon,
} from "lucide-react";
import { ChannelSettings } from "@/components/settings/ChannelSettings";
import { WebhookSettings } from "@/components/settings/WebhookSettings";
// import { AccountSettings } from "@/components/settings/AccountSettings";
import { ApiKeySettings } from "@/components/settings/ApiKeySettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import StorageSettings from "@/components/settings/StorageSettings";
import AISettings from "@/components/settings/AISettings";
import { useAuth } from "@/contexts/auth-context";
import FirebaseSettings from "@/components/settings/FirebaseSettings";
import { useTranslation } from "@/lib/i18n";
import SMTPSettings from "@/components/settings/SmtpSettings";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general_setting");
  const { user } = useAuth();
  const isAdmin = user?.role === "superadmin";

  const { t } = useTranslation();

  useEffect(() => {
    if (user?.role !== "superadmin") {
      setActiveTab("whatsapp");
    }
  }, [user]);

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header
        title={t("settings.headTitle")}
        subtitle={t("settings.subTitle")}
      />

      <main className="p-6 my-4">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-12 md:space-y-7"
        >
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
            {/* SUPERADMIN ONLY */}
            {user?.role === "superadmin" && (
              <>
                <TabsTrigger
                  value="general_setting"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <SettingsIcon className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">
                    {t("settings.general_setting.tabName")}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="firebase_setting"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <SettingsIcon className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">
                    {" "}
                    {t("settings.firebase.tabName")}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="storage_setting"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <Database className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">
                    {" "}
                    {t("settings.storage_setting.tabName")}
                  </span>
                </TabsTrigger>

                <TabsTrigger
                  value="smtp_setting"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <SettingsIcon className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">SMTP Setting</span>
                </TabsTrigger>
              </>
            )}

            {/* NON-SUPERADMIN ONLY */}
            {user?.role !== "superadmin" && (
              <>
                <TabsTrigger
                  value="whatsapp"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <Smartphone className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">
                    {" "}
                    {t("settings.channel_setting.tabName")}
                  </span>
                </TabsTrigger>


                {user?.role !== "admin" && (
                  <TabsTrigger
                    value="ai_setting"
                    className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                  >
                    <BotIcon className=" w-3 h-3 md:w-4 md:h-4" />
                    <span className="text-xs sm:text-base">
                      {" "}
                      {t("settings.ai_setting.tabName")}
                    </span>
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="webhooks"
                  className="flex items-center space-x-2 whitespace-nowrap justify-center sm:justify-start text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <Webhook className=" w-3 h-3 md:w-4 md:h-4" />
                  <span className="text-xs sm:text-base">
                    {" "}
                    {t("settings.webhook_setting.tabName")}
                  </span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* SUPERADMIN TAB CONTENT */}
          {user?.role === "superadmin" && (
            <>
              <TabsContent value="general_setting">
                <GeneralSettings />
              </TabsContent>

              <TabsContent value="firebase_setting">
                <FirebaseSettings />
              </TabsContent>

              <TabsContent value="storage_setting">
                <StorageSettings />
              </TabsContent>
              <TabsContent value="smtp_setting">
                <SMTPSettings />
              </TabsContent>
            </>
          )}

          {/* NON-SUPERADMIN TAB CONTENT */}
          {user?.role !== "superadmin" && (
            <>
              {user?.role !== "admin" && (
                <TabsContent value="ai_setting">
                  <AISettings />
                </TabsContent>
              )}

              <TabsContent value="whatsapp">
                <ChannelSettings />
              </TabsContent>

              <TabsContent value="webhooks">
                <WebhookSettings />
              </TabsContent>
            </>
          )}

          {/* API Keys Tab (if needed for everyone) */}
          <TabsContent value="api">
            <ApiKeySettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
