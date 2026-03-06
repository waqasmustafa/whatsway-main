// FULLY INTEGRATED WITH BACKEND API
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TablePagination } from "@/components/table-pagination";
import Header from "@/components/layout/header";
import {
  Plus,
  Send,
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Notification } from "@shared/schema";
import { z } from "zod";
import { useTranslation } from "@/lib/i18n";

export default function Notifications() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Schema with translations
  const formSchema = z.object({
    title: z.string().min(1, t("notifications.validation.titleRequired")),
    message: z.string().min(1, t("notifications.validation.messageRequired")),
    targetType: z.enum(["all", "users", "admin"]),
    targetIds: z.array(z.string()).optional(),
  });

  type FormData = z.infer<typeof formSchema>;

  // ----------- Fetch All Notifications (GET /api/notifications) ------------
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch notifications: ${response.statusText}`
        );
      }

      return response.json();
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (isError) {
      toast({
        title: t("notifications.toast.error"),
        description: error?.message || t("notifications.toast.errorLoading"),
        variant: "destructive",
      });
    }
  }, [isError, error, toast, t]);

  // ---------------- Form ----------------
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      message: "",
      targetType: "all",
      targetIds: [],
    },
  });

  // ---------------- Create & Send Notification ----------------
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        title: data.title,
        message: data.message,
        targetType: data.targetType,
        targetIds:
          data.targetIds && data.targetIds.length > 0
            ? data.targetIds
            : undefined,
      };

      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send notification");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });

      toast({
        title: t("notifications.toast.success"),
        description: t("notifications.toast.notificationSent"),
      });

      form.reset();
      setShowDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("notifications.toast.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch("/api/notifications/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete notifications");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setSelectedIds([]);
      toast({
        title: t("notifications.toast.success"),
        description: t("notifications.toast.bulkDeleted"),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("notifications.toast.error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  // ---------------- Manual Refresh ----------------
  const handleRefresh = () => {
    refetch();
    toast({
      title: t("notifications.toast.refreshing"),
      description: t("notifications.toast.refreshingDesc"),
    });
  };

  // ---------------- Pagination ----------------
  const totalItems = notifications.length;
  const start = (currentPage - 1) * itemsPerPage;
  const paginatedNotifications = notifications.slice(
    start,
    start + itemsPerPage
  );

  const sendMutation = useMutation({
    mutationFn: async (id: string | number) => {
      const response = await fetch(`/api/notifications/${id}/send`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: t("notifications.toast.success"),
        description: t("notifications.toast.notificationSentShort"),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("notifications.toast.error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex-1 min-h-screen dots-bg">
      <Header
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
      />
      <div className="py-8 px-5">
        {/* Header */}
        <div className="flex items-center justify-between my-3">
          <div></div>

          <div className="w-full flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              {t("notifications.refresh")}
            </Button>

            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("notifications.createNotification")}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                {t("notifications.stats.totalSent")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                {notifications.length}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {t("notifications.stats.allNotifications")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm mt-4">
          <CardHeader className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-base sm:text-lg">
                {t("notifications.table.title")}
              </CardTitle>
              <div className="flex items-center gap-4">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => bulkDeleteMutation.mutate(selectedIds)}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("notifications.bulkDelete")} ({selectedIds.length})
                  </Button>
                )}
                <div className="text-xs sm:text-sm text-gray-500">
                  {totalItems} {t("notifications.table.total")}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 sm:h-64 px-4">
                <Loader2 className="animate-spin w-8 h-8 sm:w-10 sm:h-10 text-green-600 mb-4" />
                <p className="text-sm text-gray-500">
                  {t("notifications.loading")}
                </p>
              </div>
            ) : paginatedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <p className="text-sm sm:text-base font-medium text-gray-900 mb-2">
                  {t("notifications.empty.title")}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
                  {t("notifications.empty.description")}
                </p>
                <Button
                  onClick={() => setShowDialog(true)}
                  className="bg-green-600 hover:bg-green-700 text-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t("notifications.empty.button")}
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[50px] px-3 lg:px-6 py-3">
                          <Checkbox
                            checked={
                              paginatedNotifications.length > 0 &&
                              selectedIds.length === paginatedNotifications.length
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIds(
                                  paginatedNotifications.map((n) => String(n.id))
                                );
                              } else {
                                setSelectedIds([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.id")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.titleColumn")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.message")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.target")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.status")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.sentAt")}
                        </TableHead>
                        <TableHead className="w-[100px] px-3 lg:px-6 py-3 text-xs font-semibold text-gray-600 uppercase">
                          {t("notifications.table.action")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedNotifications.map((n) => (
                        <TableRow key={n.id} className="hover:bg-gray-50">
                          <TableCell className="px-3 lg:px-6 py-3">
                            <Checkbox
                              checked={selectedIds.includes(String(n.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedIds((prev) => [...prev, String(n.id)]);
                                } else {
                                  setSelectedIds((prev) =>
                                    prev.filter((id) => id !== String(n.id))
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 font-mono text-xs text-gray-600">
                            {String(n.id).slice(0, 8)}
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 text-sm font-medium text-gray-900">
                            {n.title}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {n.message}
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 font-mono text-xs text-gray-600">
                            <StatusBadge status={n.targetType} variant="info" />
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 font-mono text-xs text-gray-600">
                            <StatusBadge
                              status={n.status || "sent"}
                              variant={
                                n.status === "sent" ? "success" : "warning"
                              }
                            />
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 font-mono text-xs text-gray-600">
                            {n.sentAt
                              ? new Date(n.sentAt).toLocaleString()
                              : n.createdAt
                                ? new Date(n.createdAt).toLocaleString()
                                : "-"}
                          </TableCell>
                          <TableCell className="px-3 lg:px-6 py-3 font-mono text-xs text-gray-600">
                            {n.status !== "sent" ? (
                              <Button
                                size="sm"
                                onClick={() => sendMutation.mutate(n.id)}
                                disabled={sendMutation.isPending}
                              >
                                {sendMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  t("notifications.table.send")
                                )}
                              </Button>
                            ) : (
                              <span className="text-green-600 text-sm">
                                {t("notifications.table.sent")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="sm:hidden space-y-3 p-3">
                  {paginatedNotifications.map((n) => (
                    <div
                      key={n.id}
                      className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-4 mb-3">
                        <Checkbox
                          checked={selectedIds.includes(String(n.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds((prev) => [...prev, String(n.id)]);
                            } else {
                              setSelectedIds((prev) =>
                                prev.filter((id) => id !== String(n.id))
                              );
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1 gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                              {n.title}
                            </h3>
                            <StatusBadge status={n.targetType} variant="info" />
                          </div>
                          <p className="text-xs font-mono text-gray-500">
                            {String(n.id).slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          {t("notifications.card.sentAt")}
                        </span>
                        <div className="text-right">
                          {n.sentAt ? (
                            <>
                              <div className="text-xs text-gray-900 font-medium">
                                {new Date(n.sentAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(n.sentAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {totalItems > 0 && (
              <TablePagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
              />
            )}
          </CardContent>
        </Card>

        {/* Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("notifications.dialog.title")}</DialogTitle>
              <DialogDescription>
                {t("notifications.dialog.description")}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <div>
                <Label htmlFor="title">
                  {t("notifications.dialog.titleLabel")}{" "}
                  <span className="text-destructive">
                    {t("notifications.dialog.required")}
                  </span>
                </Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder={t("notifications.dialog.titlePlaceholder")}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="message">
                  {t("notifications.dialog.messageLabel")}{" "}
                  <span className="text-destructive">
                    {t("notifications.dialog.required")}
                  </span>
                </Label>
                <Textarea
                  id="message"
                  rows={5}
                  {...form.register("message")}
                  placeholder={t("notifications.dialog.messagePlaceholder")}
                />
                {form.formState.errors.message && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.message.message}
                  </p>
                )}
              </div>

              <div>
                <Label>{t("notifications.dialog.targetLabel")}</Label>
                <Select
                  value={form.watch("targetType")}
                  onValueChange={(v) => form.setValue("targetType", v as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("notifications.dialog.targetOptions.all")}
                    </SelectItem>
                    {/* <SelectItem value="users">
                      {t("notifications.dialog.targetOptions.users")}
                    </SelectItem>
                    <SelectItem value="admins">
                      {t("notifications.dialog.targetOptions.admins")}
                    </SelectItem>
                    <SelectItem value="team">
                      {t("notifications.dialog.targetOptions.team")}
                    </SelectItem>
                    <SelectItem value="specific">
                      {t("notifications.dialog.targetOptions.specific")}
                    </SelectItem> */}
                  </SelectContent>
                </Select>
              </div>

              {form.watch("targetType") === "specific" && (
                <div>
                  <Label htmlFor="targetIds">
                    {t("notifications.dialog.userIdsLabel")}{" "}
                    <span className="text-destructive">
                      {t("notifications.dialog.required")}
                    </span>
                  </Label>
                  <Input
                    id="targetIds"
                    placeholder={t("notifications.dialog.userIdsPlaceholder")}
                    onChange={(e) =>
                      form.setValue(
                        "targetIds",
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                  {form.formState.errors.targetIds && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.targetIds.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  form.reset();
                }}
                disabled={createMutation.isPending}
              >
                {t("notifications.dialog.cancel")}
              </Button>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    {t("notifications.dialog.sending")}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {t("notifications.dialog.sendNow")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
