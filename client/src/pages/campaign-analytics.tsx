import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import Header from "@/components/layout/header";
import { Loading } from "@/components/ui/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageChart } from "@/components/charts/message-chart";
import {
  ArrowLeft,
  Eye,
  XCircle,
  Download,
  CheckCircle,
  Send,
  AlertCircle,
  Users
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Simple fallback chart component
const SimpleDailyChart = ({ data }: { data: any[] }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>No chart data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        Daily Performance Overview
      </div>
      {data.map((item, index) => (
        <div key={index} className="border rounded-lg p-4 bg-white">
          <div className="flex justify-between items-center mb-3">
            <span className="font-medium text-gray-900">{item.date}</span>
            <div className="text-sm text-gray-500">
              Total: {(item.sent || 0) + (item.delivered || 0) + (item.read || 0) + (item.failed || 0)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="text-center p-2 bg-blue-50 rounded">
              <div className="text-blue-600 font-bold text-lg">{item.sent || 0}</div>
              <div className="text-gray-600 text-xs">Sent</div>
            </div>
            <div className="text-center p-2 bg-green-50 rounded">
              <div className="text-green-600 font-bold text-lg">{item.delivered || 0}</div>
              <div className="text-gray-600 text-xs">Delivered</div>
            </div>
            <div className="text-center p-2 bg-orange-50 rounded">
              <div className="text-orange-600 font-bold text-lg">{item.read || 0}</div>
              <div className="text-gray-600 text-xs">Read</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded">
              <div className="text-red-600 font-bold text-lg">{item.failed || 0}</div>
              <div className="text-gray-600 text-xs">Failed</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Safe chart wrapper component
const SafeMessageChart = ({ data }: { data: any[] }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [data]);

  if (hasError) {
    return <SimpleDailyChart data={data} />;
  }

  try {
    // Validate data before passing to chart
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No chart data available</p>
          </div>
        </div>
      );
    }

    // Check if we have valid data for the chart
    const hasValidData = data.some(item =>
      item &&
      typeof item === 'object' &&
      item.date &&
      item.date !== "Unknown" &&
      (item.sent > 0 || item.delivered > 0 || item.read > 0 || item.failed > 0)
    );

    if (!hasValidData) {
      return <SimpleDailyChart data={data} />;
    }

    // Try to render the MessageChart with error handling
    return (
      <div>
        <MessageChart data={data} />
      </div>
    );
  } catch (error) {
    console.error("Chart error:", error);
    setHasError(true);
    return <SimpleDailyChart data={data} />;
  }
};

export default function CampaignAnalytics() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [exportLoading, setExportLoading] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch campaign details and analytics
  useEffect(() => {
    if (!campaignId) return;

    const fetchCampaignData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analytics/campaigns/${campaignId}`);
        console.log("Response status:", response);
        if (!response.ok) {
          throw new Error(`Failed to fetch campaign analytics: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Fetched campaign data:", data);
        setCampaignData(data);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "Unknown error occurred while fetching campaign data");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignData();
  }, [campaignId]);

  // Safely extract data with fallbacks
  const campaign = campaignData?.campaign || {};
  const dailyStats = Array.isArray(campaignData?.dailyStats) ? campaignData.dailyStats : [];
  const recipientStats = Array.isArray(campaignData?.recipientStats) ? campaignData.recipientStats : [];
  const errorAnalysis = Array.isArray(campaignData?.errorAnalysis) ? campaignData.errorAnalysis : [];

  // console.log("Campaign Data:", campaignData);
  // console.log("Daily Stats:", dailyStats);

  // Calculate metrics with safe math
  const safeNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) || num < 0 ? 0 : num;
  };

  // const sentCount = safeNumber(campaign.sentCount);
  const deliveredCount = safeNumber(campaign.deliveredCount);
  const recipientCount = safeNumber(campaign.recipientCount);
  const readCount = safeNumber(campaign.readCount);
  const repliedCount = safeNumber(campaign.repliedCount);
  const failedCount = safeNumber(campaign.failedCount);
  const sentCount = (Number(deliveredCount) + Number(failedCount)) || 0;

  const readRate = sentCount > 0 ? (readCount / sentCount) * 100 : 0;



  // Process chart data with robust error handling
  const chartData = dailyStats.map((stat: any, index: number) => {
    // Helper function to safely convert to number
    const toNumber = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num = Number(value);
      return isNaN(num) ? 0 : num;
    };

    // Helper function to safely format date
    const formatDate = (dateValue: any): string => {
      try {
        if (!dateValue) return `Day ${index + 1}`;

        let date: Date;
        if (typeof dateValue === 'string') {
          // Handle date strings like "2025-09-08"
          if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = new Date(dateValue + 'T00:00:00.000Z');
          } else {
            date = new Date(dateValue);
          }
        } else if (dateValue instanceof Date) {
          date = dateValue;
        } else {
          return `Day ${index + 1}`;
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn("Invalid date:", dateValue);
          return `Day ${index + 1}`;
        }

        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      } catch (error) {
        console.error("Error formatting date:", error, dateValue);
        return `Day ${index + 1}`;
      }
    };

    // Ensure we have a valid stat object
    if (!stat || typeof stat !== 'object') {
      console.warn("Invalid stat object:", stat);
      return {
        date: `Day ${index + 1}`,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
      };
    }

    const processedStat = {
      date: formatDate(stat.date),
      sent: toNumber(stat.sent),
      delivered: toNumber(stat.delivered),
      read: toNumber(stat.read),
      failed: toNumber(stat.failed),
    };

    console.log("Processed stat:", processedStat);
    return processedStat;
  });

  console.log("Final chartData:", chartData);

  // Handle export
  const handleExport = async (format: "pdf" | "excel") => {
    if (!campaignId) {
      toast({
        title: "Export failed",
        description: "Campaign ID is missing",
        variant: "destructive",
      });
      return;
    }

    setExportLoading(true);
    try {
      const params = new URLSearchParams({
        format,
        type: "campaigns",
        campaignId: campaignId,
      });

      const response = await fetch(`/api/analytics/export?${params}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-${campaign.name || 'unnamed'}-${new Date().toISOString().split("T")[0]
        }.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Campaign report exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export campaign report",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 dots-bg">
        <Header title="Campaign Analytics" subtitle="Loading..." />
        <div className="p-6">
          <Loading size="lg" text="Loading campaign analytics..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 dots-bg">
        <Header title="Campaign Analytics" subtitle="Error loading campaign" />
        <div className="p-6">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error Loading Campaign
              </h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <div className="flex justify-center space-x-2">
                <Link href="/analytics">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Analytics
                  </Button>
                </Link>
                <Button
                  onClick={() => window.location.reload()}
                  variant="default"
                >
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Campaign not found state
  if (!campaign?.id) {
    return (
      <div className="flex-1 dots-bg">
        <Header title="Campaign Analytics" subtitle="Campaign not found" />
        <div className="p-6">
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Campaign Not Found
              </h3>
              <p className="text-gray-500 mb-4">
                The requested campaign could not be found or you don't have access to it.
              </p>
              <Link href="/analytics">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header
        title={`Campaign: ${campaign.name || 'Unnamed Campaign'}`}
        subtitle="Detailed campaign performance analytics"
      />

      <main className="p-6 space-y-6">
        {/* Navigation and Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Link href="/analytics">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Analytics
                </Button>
              </Link>
              {/* <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={exportLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exportLoading ? "Exporting..." : "Export PDF"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("excel")}
                  disabled={exportLoading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exportLoading ? "Exporting..." : "Export Excel"}
                </Button>
              </div> */}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Info */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Type</p>
                <p className="font-medium">{campaign.type || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full
                  ${campaign.status === "active"
                      ? "bg-green-100 text-green-800"
                      : campaign.status === "completed"
                        ? "bg-blue-100 text-blue-800"
                        : campaign.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {campaign.status || 'Unknown'}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">API Type</p>
                <p className="font-medium">{campaign.apiType || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Campaign Type</p>
                <p className="font-medium capitalize">{campaign.campaignType || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Template</p>
                <p className="font-medium">{campaign.templateName || 'No template'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Language</p>
                <p className="font-medium">{campaign.templateLanguage || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="font-medium">
                  {campaign.createdAt
                    ? new Date(campaign.createdAt).toLocaleString()
                    : 'Unknown'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="font-medium">
                  {campaign.scheduledAt
                    ? new Date(campaign.scheduledAt).toLocaleString()
                    : "Immediate"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="font-medium">
                  {campaign.completedAt
                    ? new Date(campaign.completedAt).toLocaleString()
                    : "In Progress"}
                </p>
              </div>
            </div>

            {/* Description */}
            {campaign.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-medium">{campaign.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Recipients</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {safeNumber(campaign.recipientCount).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Messages Sent</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {sentCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-green-50 rounded-lg">
                  <Send className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Read</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {readCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {readRate.toFixed(1)}% Read Rate
                  </p>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Eye className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {failedCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sentCount > 0 ? ((failedCount / sentCount) * 100).toFixed(1) : "0.0"}% Failed Rate
                  </p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Chart and Status Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Daily Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <SafeMessageChart data={chartData} />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No daily performance data available</p>
                    <p className="text-sm text-gray-400 mt-1">
                      This campaign may not have detailed daily tracking data.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Message Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {recipientStats.length > 0 ? (
                <div className="space-y-4">
                  {recipientStats
                    .filter((stat: any) => !["delivered", "pending"].includes(stat.status))
                    .map((stat: any, index: number) => {
                      const total = recipientStats
                        .filter((s: any) => !["delivered", "pending"].includes(s.status))
                        .reduce(
                          (sum: number, s: any) => sum + safeNumber(s.count),
                          0
                        );
                      const count = safeNumber(stat.count);
                      const percentage = total > 0 ? (count / total) * 100 : 0;

                      return (
                        <div
                          key={`${stat.status}-${index}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-3 h-3 rounded-full ${stat.status === "delivered"
                                  ? "bg-green-500"
                                  : stat.status === "read"
                                    ? "bg-blue-500"
                                    : stat.status === "failed"
                                      ? "bg-red-500"
                                      : stat.status === "pending"
                                        ? "bg-yellow-500"
                                        : stat.status === "sent"
                                          ? "bg-purple-500"
                                          : "bg-gray-500"
                                }`}
                            />
                            <span className="text-sm capitalize font-medium">
                              {stat.status || 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold">
                              {count}
                            </span>
                            <span className="text-sm text-gray-500">
                              ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                    <p className="text-sm">No status data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Analysis */}
        {errorAnalysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Error Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Error Code
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Error Message
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Occurrences
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {errorAnalysis.map((error: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                            {error.errorCode || "N/A"}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {error.errorMessage || "No error message provided"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {safeNumber(error.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Campaign Stats */}
        {(campaign.contactGroups?.length > 0 || campaign.csvData?.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {campaign.contactGroups?.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Contact Groups</p>
                    <p className="font-medium">{campaign.contactGroups.length} group(s) selected</p>
                  </div>
                )}
                {campaign.csvData?.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">CSV Data</p>
                    <p className="font-medium">{campaign.csvData.length} records imported</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}