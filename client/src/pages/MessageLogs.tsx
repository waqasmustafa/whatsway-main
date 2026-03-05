import React, { useState } from "react";
import {
  FileText,
  Search,
  CheckCheck,
  Clock,
  AlertCircle,
  XCircle,
  MessageSquare,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Trash2,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import LoadingAnimation from "@/components/LoadingAnimation";

const MessageLogs = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState("7d");
  const [expandedMessage, setExpandedMessage] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: messages = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/messages/logs", filterStatus, dateRange, searchTerm],
    queryFn: async ({ queryKey }) => {
      const [_url, status, date, search] = queryKey;
      const params = new URLSearchParams();
      if (status !== "all") params.append("status", status as string);
      if (date !== "all") params.append("dateRange", date as string);
      if (search) params.append("search", search as string);

      const res = await apiClient.get(`/api/messages/logs?${params.toString()}`);
      return res;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiClient.delete("/api/messages/logs", { ids });
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("contacts.deleteContacts.successDesc") || "Messages deleted successfully",
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "read":
        return "bg-green-100 text-green-800 border-green-200";
      case "sent":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case "read":
        return <CheckCheck className="w-4 h-4 text-green-500" />;
      case "sent":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const toggleMessageExpand = (id: number) => {
    setExpandedMessage(expandedMessage === id ? null : id);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(messages.map((m) => m.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleDeleteSelected = () => {
    if (window.confirm(t("contacts.deleteContacts.description") || "Are you sure you want to delete selected messages?")) {
      deleteMutation.mutate(selectedIds);
    }
  };

  if (isLoading) return <LoadingAnimation />;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center space-x-3">
              <div className="bg-primary/10 p-2 rounded-xl">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {t("messageLogs.title")}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Track all sent messages and their delivery status
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="hidden sm:flex"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("common.refresh")}
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("common.delete")} ({selectedIds.length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Messages"
            value={messages.length}
            icon={<MessageSquare className="w-5 h-5" />}
            color="blue"
          />
          <StatCard
            title="Delivered"
            value={messages.filter(m => m.status === 'delivered' || m.status === 'read').length}
            icon={<CheckCheck className="w-5 h-5" />}
            color="green"
          />
          <StatCard
            title="Read"
            value={messages.filter(m => m.status === 'read').length}
            icon={<Eye className="w-5 h-5" />}
            color="purple"
          />
          <StatCard
            title="Failed"
            value={messages.filter(m => m.status === 'failed').length}
            icon={<AlertCircle className="w-5 h-5" />}
            color="red"
          />
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search phone or content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="1d">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 border-b">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <Checkbox
                      checked={messages.length > 0 && selectedIds.length === messages.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">{t("common.status")}</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Phone Number</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Contact</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">{t("common.type")}</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Content</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Error</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-600">Sent At</th>
                  <th className="px-6 py-4 text-right font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {messages.map((message) => (
                  <React.Fragment key={message.id}>
                    <tr className={`hover:bg-gray-50/50 transition-colors ${selectedIds.includes(message.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selectedIds.includes(message.id)}
                          onCheckedChange={(checked) => handleSelectOne(message.id, !!checked)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`gap-1 w-fit font-medium ${getStatusColor(message.status)}`}>
                            {getStatusIcon(message.status)}
                            {message.status}
                          </Badge>
                          {message.deliveredAt && (
                            <span className="text-[10px] text-muted-foreground pl-1">
                              Delivered: {format(new Date(message.deliveredAt), "h:mm a")}
                            </span>
                          )}
                          {message.readAt && (
                            <span className="text-[10px] text-muted-foreground pl-1">
                              Read: {format(new Date(message.readAt), "h:mm a")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700">{message.phoneNumber}</td>
                      <td className="px-6 py-4 text-gray-600">{message.contactName || "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="font-normal capitalize">
                          {message.direction || "Outbound"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-gray-600" title={message.content}>
                        {message.content}
                      </td>
                      <td className="px-6 py-4">
                        {message.errorCode ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-red-600 font-semibold text-xs flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Code: {message.errorCode}
                            </span>
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {message.errorMessage || "Message undeliverable"}
                            </span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                        {format(new Date(message.createdAt), "MMM d, h:mm a")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleMessageExpand(message.id)}
                        >
                          {expandedMessage === message.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                    {expandedMessage === message.id && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
                            <DetailItem label="Full Message Content" value={message.content} fullWidth />
                            <DetailItem label="WhatsApp Message ID" value={message.whatsappMessageId} />
                            <DetailItem label="Channel ID" value={message.channelId} />
                            {message.errorMessage && <DetailItem label="Error Message" value={message.errorMessage} color="red" />}
                            {message.errorDetails && <DetailItem label="Error Details" value={JSON.stringify(message.errorDetails)} fullWidth />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {messages.length === 0 && (
            <div className="py-20 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium">{t("messageLogs.noLogs")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${colors[color] || "bg-gray-50 text-gray-600"}`}>
        {icon}
      </div>
    </div>
  );
};

const DetailItem = ({ label, value, color, fullWidth }: any) => (
  <div className={`flex flex-col gap-1.5 ${fullWidth ? 'col-span-full' : ''}`}>
    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
    <span className={`text-[13px] break-all ${color === 'red' ? 'text-red-600' : 'text-gray-700'}`}>
      {value || "None"}
    </span>
  </div>
);

export default MessageLogs;
