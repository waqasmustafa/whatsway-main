import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Webhook,
  Plus,
  Copy,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WebhookConfig } from "@shared/schema";
import { Loading } from "@/components/ui/loading";
import { WebhookDialog } from "./WebhookDialog";
import { WebhookFlowDiagram } from "@/components/webhook-flow-diagram";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/lib/i18n";

export function WebhookSettings() {
  const { t } = useTranslation();
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(
    null
  );
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  // Fetch webhook configs
  const {
    data: webhookConfigs = [],
    isLoading: webhooksLoading,
    isFetching: isWebhooksFetching,
    refetch: refetchWebhookConfigs,
  } = useQuery({
    queryKey: ["webhook-configs", activeChannel?.id],
    queryFn: async () => {
      const res = await fetch("/api/webhook-configs" + (activeChannel ? `-channel-id/${activeChannel.id}` : ""));
      const json = await res.json();

      console.log("Fetched JSON:", json);

      // If your API returns { success, data }
      return json.data || json; // return array ONLY
    },
  });

  // console.log("Webhook Configs:", webhookConfigs , webhooksLoading);

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      return await apiRequest("DELETE", `/api/webhook-configs/${webhookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-configs"] });
      toast({
        title: t("settings.webhook_setting.webhookDeleted"),
        description: t("settings.webhook_setting.webhookDeletedDesc"),
      });
    },
    onError: (error) => {
      toast({
        title: t("settings.webhook_setting.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test webhook mutation
  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      return await apiRequest("POST", `/api/webhook-configs/${webhookId}/test`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook-configs"] });
      toast({
        title: t("settings.webhook_setting.testSent"),
        description: t("settings.webhook_setting.testSentDesc"),
      });
    },
    onError: (error) => {
      toast({
        title: t("settings.webhook_setting.testFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t("settings.webhook_setting.copied"),
      description: t("settings.webhook_setting.copiedDesc"),
    });
  };

  const handleEditWebhook = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setShowWebhookDialog(true);
  };

  const handleDeleteWebhook = (webhookId: string) => {
    if (confirm(t("settings.webhook_setting.deleteConfirm"))) {
      deleteWebhookMutation.mutate(webhookId);
    }
  };

  const getWebhookStatus = (webhook: WebhookConfig) => {
    if (!webhook.lastPingAt)
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        text: t("settings.webhook_setting.status.noEvents"),
      };

    const lastPingDate = new Date(webhook.lastPingAt);
    const now = new Date();
    const hoursSinceLastPing =
      (now.getTime() - lastPingDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastPing < 24) {
      return {
        icon: <CheckCircle className="w-4 h-4 text-green-500" />,
        text: t("settings.webhook_setting.status.active"),
      };
    } else {
      return {
        icon: <AlertCircle className="w-4 h-4 text-yellow-500" />,
        text: t("settings.webhook_setting.status.inactive"),
      };
    }
  };

  return (
    <>
      <div className="space-y-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center mb-2 sm:mb-0 text-lg sm:text-xl">
                <Webhook className="w-5 h-5 mr-2" />
                {t("settings.webhook_setting.title")}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await refetchWebhookConfigs();
                    toast({
                      title: t("settings.webhook_setting.refreshed"),
                      description: t("settings.webhook_setting.refreshedDesc"),
                    });
                  }}
                  disabled={isWebhooksFetching}
                  className="flex items-center text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isWebhooksFetching ? "animate-spin" : ""}`} />
                  {isWebhooksFetching ? t("settings.webhook_setting.refreshing") : t("settings.webhook_setting.refresh")}
                </Button>
                <Button
                  onClick={() => {
                    setEditingWebhook(null);
                    setShowWebhookDialog(true);
                  }}
                  className="flex items-center text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("settings.webhook_setting.configureWebhook")}
                </Button>
              </div>
            </div>
            <CardDescription className="text-sm sm:text-base">
              {t("settings.webhook_setting.description")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {webhooksLoading ? (
              <Loading />
            ) : webhookConfigs.length === 0 ? (
              <div className="text-center py-12">
                <Webhook className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4 text-sm sm:text-base">
                  {t("settings.webhook_setting.noWebhooks")}
                </p>
                <div className="w-full text-center flex justify-center">
                  <Button
                    size="sm"
                    onClick={() => setShowWebhookDialog(true)}
                    className="flex items-center text-xs h-7 rounded-sm px-2 sm:h-9 sm:rounded-md sm:px-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("settings.webhook_setting.configureFirst")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {webhookConfigs.map((webhook) => {
                  const status = getWebhookStatus(webhook);
                  return (
                    <div
                      key={webhook.id}
                      className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-2">
                          <h3 className="font-semibold truncate">
                            {webhook.channelId
                              ? t("settings.webhook_setting.channelWebhook")
                              : t("settings.webhook_setting.globalWebhook")}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-xs flex items-center whitespace-nowrap"
                          >
                            {status.icon}
                            <span className="ml-1">{status.text}</span>
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                            <Label className="text-sm shrink-0">
                              {t("settings.webhook_setting.webhookUrl")}
                            </Label>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded break-all flex-1">
                              {user?.username === "demouser"
                                ? "https://your-domain.com/webhook/xxxx-xxxx-xxxx"
                                : webhook.webhookUrl}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={user?.username === "demouser"}
                              onClick={() =>
                                copyToClipboard(webhook.webhookUrl)
                              }
                              className="mt-1 sm:mt-0 flex items-center"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="flex flex-wrap items-center space-x-2">
                            <Label className="text-sm shrink-0">
                              {t("settings.webhook_setting.events")}
                            </Label>
                            <div className="flex flex-wrap gap-1">
                              {webhook.events.map((event) => (
                                <Badge
                                  key={event}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {event}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {webhook.lastPingAt && (
                            <div className="text-sm text-gray-500 truncate">
                              {t("settings.webhook_setting.lastEvent")}{" "}
                              {new Date(webhook.lastPingAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-0 flex flex-wrap gap-2 sm:space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                          disabled={
                            user?.username === "demouser"
                              ? true
                              : testWebhookMutation.isPending
                          }
                        >
                          {t("settings.webhook_setting.test")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditWebhook(webhook)}
                          disabled={user?.username === "demouser"}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          disabled={
                            user?.username === "demouser"
                              ? true
                              : deleteWebhookMutation.isPending
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Webhook Flow Diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg sm:text-xl">
              <HelpCircle className="w-5 h-5 mr-2" />
              {t("settings.webhook_setting.howItWorks.title")}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {t("settings.webhook_setting.howItWorks.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookFlowDiagram />
          </CardContent>
        </Card>

        {/* Webhook Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">
              {t("settings.webhook_setting.setupInstructions.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm sm:text-base">
            <div>
              <h4 className="font-medium mb-2">
                {t("settings.webhook_setting.setupInstructions.step1.title")}
              </h4>
              <p>
                {t(
                  "settings.webhook_setting.setupInstructions.step1.description"
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                {t("settings.webhook_setting.setupInstructions.step2.title")}
              </h4>
              <p>
                {t(
                  "settings.webhook_setting.setupInstructions.step2.description"
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                {t("settings.webhook_setting.setupInstructions.step3.title")}
              </h4>
              <p>
                {t(
                  "settings.webhook_setting.setupInstructions.step3.description"
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                {t("settings.webhook_setting.setupInstructions.step4.title")}
              </h4>
              <p>
                {t(
                  "settings.webhook_setting.setupInstructions.step4.description"
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <WebhookDialog
        channelId={activeChannel?.id}
        open={showWebhookDialog}
        onOpenChange={setShowWebhookDialog}
        editingWebhook={editingWebhook}
        onSuccess={() => {
          setShowWebhookDialog(false);
          setEditingWebhook(null);
        }}
      />
    </>
  );
}
