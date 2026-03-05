import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Header from "@/components/layout/header";
import { Loading } from "@/components/ui/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Eye,
  PlusCircle,
  CheckCircle,
  Send,
  AlertCircle,
  Target,
  Activity,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { StateDisplay } from "@/components/StateDisplay";
import { useTranslation } from "@/lib/i18n";
export default function Analytics() {
  const { user } = useAuth();

  const { t } = useTranslation();
  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });
  // Fetch campaign analytics
  const { data: campaignAnalytics, isLoading: campaignLoading } = useQuery({
    queryKey: ["/api/analytics/campaigns", activeChannel?.id],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(activeChannel?.id && { channelId: activeChannel.id }),
      });
      const response = await fetch(`/api/analytics/campaigns?${params}`);
      if (!response.ok) throw new Error("Failed to fetch campaign analytics");
      return await response.json();
    },
    enabled: !!activeChannel,
  });

  const campaignMetrics = campaignAnalytics?.summary || {};

  // Transform daily stats for chart
  const chartData = [];

  if (campaignLoading) {
    return (
      <div className="flex-1 dots-bg">
        <Header title="Analytics" subtitle="Loading analytics..." />
        <div className="p-6">
          <Loading size="lg" text="Loading analytics data..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header title={t("analytics.title")} subtitle={t("analytics.subtitle")} />

      <main className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">


        {/* Analytics Tabs */}
        {campaignAnalytics?.campaigns?.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 sm:py-12 px-4">
              <Target className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                No Campaigns Found
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Start creating campaigns to see analytics here
              </p>
              <Link href="/campaigns">
                <Button className="bg-green-600 hover:bg-green-700 text-sm">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Campaign Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    {t("analytics.CampaignsTab.Total_Sent")}
                  </CardTitle>
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-bold">
                    {Number(campaignMetrics.totalDelivered) -
                      Number(campaignMetrics.totalFailed) || 0}
                  </div>
                </CardContent>
              </Card>



              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    {t("analytics.CampaignsTab.Total_Read")}
                  </CardTitle>
                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-bold">
                    {campaignMetrics.totalRead || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
                  <CardTitle className="text-xs sm:text-sm font-medium">
                    {t("analytics.CampaignsTab.Total_Failed")}
                  </CardTitle>
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="text-lg sm:text-2xl font-bold">
                    {campaignMetrics.totalFailed || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaign Performance Table */}
            <Card>
              <CardHeader className="px-4 sm:px-6 py-3 sm:py-4">
                <CardTitle className="text-base sm:text-lg">
                  {t("analytics.CampaignsTab.Campaign_Performance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campaign
                        </th>
                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Recipients
                        </th>
                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                          Sent
                        </th>

                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                          Read
                        </th>

                        <th className="text-left px-3 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {campaignAnalytics?.campaigns?.map((campaign: any) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-3 lg:px-6 py-3 lg:py-4">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[150px]">
                              {campaign.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {campaign.type}
                            </div>
                          </td>
                          <td className="px-3 lg:px-6 py-3 lg:py-4">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${campaign.status === "active"
                                ? "bg-green-100 text-green-800"
                                : campaign.status === "completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                                }`}
                            >
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-3 lg:px-6 py-3 lg:py-4 text-xs sm:text-sm text-gray-900">
                            {campaign.recipientCount || 0}
                          </td>
                          <td className="px-3 lg:px-6 py-3 lg:py-4 text-xs sm:text-sm text-gray-900 hidden lg:table-cell">
                            {Number(campaign.deliveredCount) +
                              Number(campaign.failedCount) || 0}
                          </td>

                          <td className="px-3 lg:px-6 py-3 lg:py-4 text-xs sm:text-sm text-gray-900 hidden xl:table-cell">
                            {campaign.readCount || 0}
                          </td>

                          <td className="px-3 lg:px-6 py-3 lg:py-4">
                            <Link href={`/analytics/campaign/${campaign.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                              >
                                <Activity className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden lg:inline">
                                  View Details
                                </span>
                                <span className="lg:hidden">View</span>
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3 p-3">
                  {campaignAnalytics?.campaigns?.map((campaign: any) => (
                    <div
                      key={campaign.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {campaign.name}
                          </h3>
                          <p className="text-xs text-gray-500">{campaign.type}</p>
                        </div>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${campaign.status === "active"
                            ? "bg-green-100 text-green-800"
                            : campaign.status === "completed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {campaign.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-3 pb-3 border-b border-gray-100">
                        <div>
                          <span className="text-gray-500">Recipients:</span>
                          <span className="font-medium ml-1">
                            {campaign.recipientCount || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Sent:</span>
                          <span className="font-medium ml-1">
                            {Number(campaign.deliveredCount) +
                              Number(campaign.failedCount) || 0}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-500">Read:</span>
                          <span className="font-medium ml-1">
                            {campaign.readCount || 0}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">

                        <Link href={`/analytics/campaign/${campaign.id}`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Activity className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
