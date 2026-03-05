import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Search,
  Phone,
  User,
  Calendar,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { Loading } from "@/components/ui/loading";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/lib/i18n";

interface MessageLog {
  id: string;
  channelId: string;
  phoneNumber: string;
  contactName?: string;
  messageType: string;
  content: string;
  templateName?: string;
  status: "sent" | "delivered" | "read" | "failed" | "pending";
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: {
    code: string;
    title: string;
    message?: string;
    errorData?: any;
  };
  deliveredAt?: string;
  readAt?: string;
  whatsappMessageId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Logs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("7d");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const { t } = useTranslation();

  // Get active channel
  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  // Fetch message logs
  const {
    data: logs = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<MessageLog[]>({
    queryKey: [
      "/api/messages/logs",
      activeChannel?.id,
      statusFilter,
      dateFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeChannel?.id) params.append("channelId", activeChannel.id);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (dateFilter !== "all") params.append("dateRange", dateFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(`/api/messages/logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!activeChannel,
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("DELETE", "/api/messages/logs", { ids });
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: "Messages deleted successfully",
      });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/messages/logs"] });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error.message || "Failed to delete messages",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(logs.map((l: MessageLog) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev: string[]) => [...prev, id]);
    } else {
      setSelectedIds((prev: string[]) => prev.filter((i: string) => i !== id));
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm("Are you sure you want to delete selected messages?")) {
      deleteMutation.mutate(selectedIds);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case "read":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "sent":
        return <Clock className="w-4 h-4 text-gray-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string, messageType: string) => {
    if (messageType === "received") {
      return "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 border-gray-300";
    }

    switch (status) {
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300";
      case "delivered":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300";
      case "read":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300";
      case "sent":
      case "pending":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300";
    }
  };

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header
        title={t("messageLog.headerTitle")}
        subtitle={t("messageLog.headerSubTitle")}
      />

      <main className="p-3 sm:p-4 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <MessageSquare className="w-5 h-5" />
                  {t("messageLog.messageHis.title")}
                </CardTitle>
                <CardDescription className="text-sm">
                  {t("messageLog.messageHis.subtitle")}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={deleteMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t("common.delete")} ({selectedIds.length})
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
                  />
                  {t("messageLog.Refresh")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col gap-3 mb-4 sm:mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search phone or content..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] text-sm">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] text-sm">
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">Last 24 hours</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Logs Content */}
            {isLoading ? (
              <Loading />
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-2">No message logs found</p>
                <p className="text-sm text-gray-400">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Send some messages to see them here"}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={logs.length > 0 && selectedIds.length === logs.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Sent At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: MessageLog) => (
                        <TableRow key={log.id} className={selectedIds.includes(log.id) ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(log.id)}
                              onCheckedChange={(checked: boolean) => handleSelectOne(log.id, !!checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                  log.status,
                                  log.messageType
                                )}`}
                              >
                                {getStatusIcon(log.status)}
                                {log.status}
                              </div>
                              {log.deliveredAt && (
                                <div className="text-xs text-gray-500">
                                  Delivered:{" "}
                                  {format(new Date(log.deliveredAt), "h:mm a")}
                                </div>
                              )}
                              {log.readAt && (
                                <div className="text-xs text-gray-500">
                                  Read: {format(new Date(log.readAt), "h:mm a")}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {user?.username === "demouser"
                              ? log.phoneNumber
                                .slice(0, -4)
                                .replace(/\d/g, "*") +
                              log.phoneNumber.slice(-4)
                              : log.phoneNumber}
                          </TableCell>
                          <TableCell>
                            {user?.username === "demouser" && log.contactName
                              ? log.contactName.slice(0, -1).replace(/./g, "*") +
                              log.contactName.slice(-1)
                              : log.contactName || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {log.messageType === "sent"
                                ? "Outbound"
                                : log.messageType === "received"
                                  ? "Inbound"
                                  : log.messageType === "template"
                                    ? `Template: ${log.templateName || "Unknown"}`
                                    : log.messageType}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.content}
                          </TableCell>
                          <TableCell>
                            {log.status === "failed" &&
                              (log.errorCode || log.errorDetails) ? (
                              <div className="text-sm">
                                <div className="flex items-center gap-1 text-red-600">
                                  <AlertCircle className="w-3 h-3" />
                                  {log.errorDetails?.code || log.errorCode
                                    ? `Code: ${log.errorDetails?.code || log.errorCode
                                    }`
                                    : "Error"}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {log.errorDetails?.title ||
                                    log.errorDetails?.message ||
                                    log.errorMessage ||
                                    "Message failed"}
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {format(new Date(log.createdAt), "MMM d, h:mm a")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden space-y-3">
                  {logs.map((log) => (
                    <Card key={log.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="font-mono text-sm font-medium truncate">
                                {user?.username === "demouser"
                                  ? log.phoneNumber
                                    .slice(0, -4)
                                    .replace(/\d/g, "*") +
                                  log.phoneNumber.slice(-4)
                                  : log.phoneNumber}
                              </span>
                            </div>
                            {log.contactName && (
                              <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-600 truncate">
                                  {user?.username === "demouser" && log.contactName
                                    ? log.contactName.slice(0, -1).replace(/./g, "*") +
                                    log.contactName.slice(-1)
                                    : log.contactName || "-"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${getStatusColor(
                              log.status,
                              log.messageType
                            )}`}
                          >
                            {getStatusIcon(log.status)}
                            {log.status}
                          </div>
                        </div>

                        {/* Type Badge */}
                        <div className="mb-3">
                          <Badge variant="outline" className="text-xs">
                            {log.messageType === "sent"
                              ? "Outbound"
                              : log.messageType === "received"
                                ? "Inbound"
                                : log.messageType === "template"
                                  ? `Template: ${log.templateName || "Unknown"}`
                                  : log.messageType}
                          </Badge>
                        </div>

                        {/* Content */}
                        <div className="mb-3 pb-3 border-b">
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {log.content}
                          </p>
                        </div>

                        {/* Timestamps */}
                        <div className="space-y-1 text-xs text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Sent:{" "}
                            {format(new Date(log.createdAt), "MMM d, h:mm a")}
                          </div>
                          {log.deliveredAt && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-blue-600" />
                              Delivered:{" "}
                              {format(new Date(log.deliveredAt), "h:mm a")}
                            </div>
                          )}
                          {log.readAt && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              Read: {format(new Date(log.readAt), "h:mm a")}
                            </div>
                          )}
                        </div>

                        {/* Error */}
                        {log.status === "failed" &&
                          (log.errorCode || log.errorDetails) && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-center gap-1 text-red-600 text-sm font-medium mb-1">
                                <AlertCircle className="w-4 h-4" />
                                {log.errorDetails?.code || log.errorCode
                                  ? `Error Code: ${log.errorDetails?.code || log.errorCode
                                  }`
                                  : "Error"}
                              </div>
                              <p className="text-xs text-red-700">
                                {log.errorDetails?.title ||
                                  log.errorDetails?.message ||
                                  log.errorMessage ||
                                  "Message failed to send"}
                              </p>
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
