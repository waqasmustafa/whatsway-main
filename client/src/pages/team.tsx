import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/lib/i18n";

export default function TeamPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["/api/team/activity-logs"],
  });

  const bulkDeleteLogsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch("/api/team/activity-logs/bulk", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete logs");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team/activity-logs"] });
      setSelectedIds([]);
      toast({
        title: t("common.success"),
        description: t("team.toast.bulkDeleted"),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t("common.error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "inactive":
        return "secondary";
      case "suspended":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getOnlineStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "inactive":
        return "bg-gray-500";
      default:
        return "bg-yellow-400";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t("team.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("team.subtitle")}
          </p>
        </div>

        <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
          <CardHeader className="border-b bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {t("team.Activity_LogsTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("team.Activity_LogsDes")}
                  </CardDescription>
                </div>
              </div>
              {selectedIds.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => bulkDeleteLogsMutation.mutate(selectedIds)}
                  disabled={bulkDeleteLogsMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("team.bulkDelete")} ({selectedIds.length})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50/50">
                  <TableRow>
                    <TableHead className="w-[50px] px-6 py-3">
                      <Checkbox
                        checked={
                          activityLogs.length > 0 &&
                          selectedIds.length === activityLogs.length
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(activityLogs.map((log: any) => String(log.id)));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead className="font-semibold">Member</TableHead>
                    <TableHead className="font-semibold">Action</TableHead>
                    <TableHead className="font-semibold">Details</TableHead>
                    <TableHead className="font-semibold">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No activity logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activityLogs.map((log: any) => (
                      <TableRow
                        key={log.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <TableCell className="px-6 py-4">
                          <Checkbox
                            checked={selectedIds.includes(String(log.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIds((prev) => [...prev, String(log.id)]);
                              } else {
                                setSelectedIds((prev) =>
                                  prev.filter((id) => id !== String(log.id))
                                );
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {user?.username === "demouser" ? (
                            <span className="bg-gray-100 px-2 py-1 rounded">
                              {log.userName
                                .slice(0, -1)
                                .replace(/./g, "*") +
                                log.userName.slice(-1)}
                            </span>
                          ) : (
                            log.userName
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          {user?.username === "demouser" ? (
                            <span className="px-2 py-1 rounded">
                              Details hidden for demo user
                            </span>
                          ) : (
                            <span>
                              <DetailsView details={log.details} />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View - Hidden on desktop */}
            <div className="md:hidden space-y-4 p-4">
              {activityLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity logs found.
                </div>
              ) : (
                activityLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="bg-white border rounded-lg p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(String(log.id))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => [...prev, String(log.id)]);
                          } else {
                            setSelectedIds((prev) =>
                              prev.filter((id) => id !== String(log.id))
                            );
                          }
                        }}
                      />
                      <div className="flex-1 space-y-3">
                        {/* Member */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Member
                          </span>
                          <span className="font-medium">
                            {user?.username === "demouser"
                              ? log.userName.slice(0, -1).replace(/./g, "*") +
                              log.userName.slice(-1)
                              : log.userName}
                          </span>
                        </div>
                        {/* Action */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">
                            Action
                          </span>
                          <Badge variant="outline">{log.action}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-muted-foreground block">
                        Details
                      </span>
                      <div className="text-sm">
                        {user?.username === "demouser" ? (
                          <span className="text-muted-foreground">
                            Details hidden for demo user
                          </span>
                        ) : (
                          <DetailsView details={log.details} />
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium text-muted-foreground">
                        Timestamp
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailsView({ details }: { details?: any }) {
  if (!details) return "-";

  if (details.updates) {
    const { role, email, firstName, lastName, permissions } = details.updates;
    return (
      <div className="space-y-1 text-sm">
        {role && (
          <div>
            <span className="font-medium">Role:</span> {role}
          </div>
        )}
        {email && (
          <div>
            <span className="font-medium">Email:</span> {email}
          </div>
        )}
        {(firstName || lastName) && (
          <div>
            <span className="font-medium">Name:</span> {firstName} {lastName}
          </div>
        )}
        {permissions?.length > 0 && (
          <div>
            <span className="font-medium">Permissions:</span>{" "}
            {permissions.join(", ")}
          </div>
        )}
      </div>
    );
  }

  if (details.createdBy) {
    return <div className="text-sm">Created By: {details.createdBy}</div>;
  }

  if (details.ipAddress) {
    return (
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium">IP:</span> {details.ipAddress}
        </div>
        {details.userAgent && (
          <div className="truncate max-w-xs" title={details.userAgent}>
            <span className="font-medium">UA:</span> {details.userAgent}
          </div>
        )}
      </div>
    );
  }

  return "-";
}
