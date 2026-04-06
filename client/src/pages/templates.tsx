import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Template } from "@shared/schema";
import { TemplatesTable } from "@/components/templates/TemplatesTable";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { TemplateDialog } from "@/components/templates/TemplateDialog";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";

type SyncFail = {
  status: string;
  message: string;
};

export default function Templates() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = user?.role;
  const { t } = useTranslation();

  // Fetch active channel
  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
  });
  const channelId = activeChannel?.id;

  // Fetch templates (paginated)
  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["templates", userRole, channelId, page, limit],
    queryFn: async () => {
      if (userRole === "superadmin") {
        const res = await fetch(`/api/templates?page=${page}&limit=${limit}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json(); // expects { data: Template[], pagination: { total, totalPages } }
      } else {
        const res = await api.getTemplates(channelId, page, limit);
        const data = await res.json();
        return data;
      }
    },
    enabled: userRole === "superadmin" || !!activeChannel,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const components = [];
      if (data.header || data.mediaType !== "text") {
        components.push({
          type: "HEADER",
          format:
            data.mediaType === "text" ? "TEXT" : data.mediaType.toUpperCase(),
          text: data.header,
        });
      }
      components.push({ type: "BODY", text: data.body });
      if (data.footer) components.push({ type: "FOOTER", text: data.footer });
      if (data.buttons?.length) {
        components.push({
          type: "BUTTONS",
          buttons: data.buttons.map((btn: any) => ({
            type: btn.type,
            text: btn.text,
            url: btn.url,
            phone_number: btn.phoneNumber,
          })),
        });
      }

      const payload = {
        name: data.name,
        category: data.category,
        language: data.language,
        components,
        header: data.header,
        body: data.body,
        footer: data.footer,
        channelId: activeChannel?.id,
      };

      if (editingTemplate) {
        return await apiRequest(
          "PATCH",
          `/api/templates/${editingTemplate.id}`,
          payload
        );
      } else {
        return await apiRequest("POST", "/api/templates", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: editingTemplate ? "Template updated" : "Template created",
        description: editingTemplate
          ? "Your template has been updated successfully."
          : "Your template has been created and submitted for approval.",
      });
      setShowDialog(false);
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) =>
      apiRequest("DELETE", `/api/templates/${templateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Template deleted",
        description: "Template deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync templates mutation
  const syncTemplatesMutation = useMutation({
    mutationFn: async () => {
      if (!activeChannel) throw new Error("No active channel");
      return await apiRequest("POST", `/api/templates/sync`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast({
        title: "Templates synced",
        description: `Synced ${data.synced || 0} templates from WhatsApp`,
      });
    },
    onError: (error) => {
      let errorData = error?.response?.data;

      // If response.data is missing, try to extract JSON from error.message
      if (!errorData && typeof error?.message === "string") {
        try {
          const match = error.message.match(/\{.*\}/);
          if (match) {
            errorData = JSON.parse(match[0]);
          }
        } catch (e) {
          console.error("Failed to parse error JSON:", e);
        }
      }

      console.log("Channel mutation error:", errorData, error);

      toast({
        title: "Error",
        description:
          errorData?.error ||
          errorData?.message ||
          error?.message ||
          "Something went wrong while saving the channel.",
        variant: "destructive",
      });
    },
  });

  // Bulk delete templates mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      apiRequest("DELETE", "/api/templates/bulk", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setSelectedIds(new Set());
      toast({
        title: "Templates deleted",
        description: "Selected templates have been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setShowDialog(true);
  };
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setShowDialog(true);
  };
  const handleDuplicateTemplate = (template: Template) => {
    setEditingTemplate({ ...template, name: `${template.name}_copy` });
    setShowDialog(true);
  };
  const handleDeleteTemplate = (template: Template) => {
    if (confirm(`Delete template "${template.name}"?`))
      deleteTemplateMutation.mutate(template.id);
  };
  const handleSyncTemplates = () => syncTemplatesMutation.mutate();

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} selected templates?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === templatesData?.data.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templatesData?.data.map((t: any) => t.id)));
    }
  };

  const toggleSelectTemplate = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  if (!activeChannel && userRole !== "superadmin") {
    return (
      <div className="flex-1 dots-bg min-h-screen">
        <Header
          title={t("templates.title")}
          subtitle={t("templates.superAdminSubTitle")}
        />
        <main className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">
                Please select or create a WhatsApp channel first
              </p>
              <Button
                className="mt-4"
                onClick={() => (window.location.href = "/settings")}
              >
                Go to Settings
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 dots-bg min-h-screen">
      <Header
        title={t("templates.title")}
        subtitle={t("templates.userSubTitle")}
      />
      <main className="p-4 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center text-lg sm:text-xl">
                <FileText className="w-5 h-5 mr-2" />
                {t("templates.mess_Temp")}
              </CardTitle>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {userRole === "superadmin" && selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
                {userRole !== "superadmin" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncTemplates}
                      disabled={syncTemplatesMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw
                        className={`w-4 h-4 mr-2 ${
                          syncTemplatesMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                      {t("templates.sync")}
                    </Button>
                    <Button
                      onClick={handleCreateTemplate}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t("templates.createTemplate")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {templatesLoading ? (
              <Loading />
            ) : (
              <>
                {/* Superadmin Table */}
                {userRole === "superadmin" ? (
                  <>
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="min-w-full border border-gray-200 bg-white rounded-lg shadow-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="py-3 px-4 text-left border-b w-10">
                              <Checkbox
                                checked={
                                  templatesData?.data.length > 0 &&
                                  selectedIds.size === templatesData?.data.length
                                }
                                onCheckedChange={toggleSelectAll}
                              />
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Name
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Created By
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Category
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Status
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Body
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                              Created At
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {templatesData?.data.map((template) => (
                            <tr
                              key={template.id}
                              className={`hover:bg-gray-50 transition-colors ${
                                selectedIds.has(template.id) ? "bg-blue-50/50" : ""
                              }`}
                            >
                              <td className="py-3 px-4 text-sm border-b">
                                <Checkbox
                                  checked={selectedIds.has(template.id)}
                                  onCheckedChange={() =>
                                    toggleSelectTemplate(template.id)
                                  }
                                />
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                                {template.name}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700">
                                {template?.createdByName?.trim() || "-"}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700">
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  {template.category}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                    template.status.toLowerCase() === "approved"
                                      ? "bg-green-100 text-green-700"
                                      : template.status.toLowerCase() ===
                                        "pending"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {template.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-700 max-w-md truncate">
                                {template.body}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600">
                                {new Date(
                                  template.createdAt
                                ).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden space-y-4">
                      {templatesData?.data.map((template) => (
                        <Card key={template.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 mb-1">
                                  {template.name}
                                </h3>
                                <p className="text-sm text-gray-600">
                                  {template?.createdByName?.trim() || "Unknown"}
                                </p>
                              </div>
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  template.status.toLowerCase() === "approved"
                                    ? "bg-green-100 text-green-700"
                                    : template.status.toLowerCase() ===
                                      "pending"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {template.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b">
                              <div>
                                <div className="text-xs text-gray-500 mb-1">
                                  Category
                                </div>
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  {template.category}
                                </span>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500 mb-1">
                                  Created
                                </div>
                                <div className="text-sm text-gray-700">
                                  {new Date(
                                    template.createdAt
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-2">
                                Message Body
                              </div>
                              <p className="text-sm text-gray-700 line-clamp-3">
                                {template.body}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Pagination */}
                    {templatesData?.pagination && (
                      <div className="w-full mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-sm text-gray-700">
                            Showing {(page - 1) * limit + 1} to{" "}
                            {Math.min(
                              page * limit,
                              templatesData.pagination.total
                            )}{" "}
                            of {templatesData.pagination.total} templates
                          </span>
                          <select
                            value={limit}
                            onChange={(e) => {
                              setLimit(Number(e.target.value));
                              setPage(1);
                            }}
                            className="border px-3 py-2 rounded-md text-sm w-24"
                          >
                            {[5, 10, 20, 50].map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-center sm:justify-end gap-2">
                          <button
                            className="px-3 py-1 border rounded disabled:opacity-50"
                            disabled={page <= 1}
                            onClick={() =>
                              setPage((prev) => Math.max(prev - 1, 1))
                            }
                          >
                            Previous
                          </button>
                          <span className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium">
                            {page}
                          </span>
                          <button
                            className="px-3 py-1 border rounded disabled:opacity-50"
                            disabled={
                              page >= templatesData.pagination.totalPages
                            }
                            onClick={() =>
                              setPage((prev) =>
                                Math.min(
                                  prev + 1,
                                  templatesData.pagination.totalPages
                                )
                              )
                            }
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <TemplatesTable
                    templates={templatesData?.data || []}
                    onViewTemplate={setSelectedTemplate}
                    onEditTemplate={handleEditTemplate}
                    onDuplicateTemplate={handleDuplicateTemplate}
                    onDeleteTemplate={handleDeleteTemplate}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Template Preview */}
      {selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {/* Template Dialog */}
      <TemplateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        template={editingTemplate}
        onSubmit={(data) => createTemplateMutation.mutate(data)}
        isSubmitting={createTemplateMutation.isPending}
      />
    </div>
  );
}
