import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquareReply,
  Plus,
  Trash2,
  Search,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";

export default function ScanAutoReplies() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newReply, setNewReply] = useState({ name: "", content: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: autoReplies, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-auto-replies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/scan-auto-replies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-auto-replies"] });
      setIsModalOpen(false);
      setNewReply({ name: "", content: "" });
      toast({ title: "Success", description: "Auto reply created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/scan-auto-replies/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-auto-replies"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scan-auto-replies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-auto-replies"] });
      toast({ title: "Deleted", description: "Auto reply removed" });
    },
  });

  const filtered = autoReplies?.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.ownerName && r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSuper ? "All Auto Message Replies" : "Auto Message Reply"}
          </h1>
          <p className="text-gray-500">
            {isSuper
              ? "View all auto reply messages created across the platform."
              : "Create reusable auto reply messages for campaign follow-ups."}
          </p>
        </div>

        {!isSuper && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" /> New
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Auto Reply Message</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="e.g. Follow Up 1"
                    value={newReply.name}
                    onChange={(e) => setNewReply({ ...newReply, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message Content</label>
                  <Textarea
                    placeholder="Type your auto reply message here..."
                    className="min-h-[150px]"
                    value={newReply.content}
                    onChange={(e) => setNewReply({ ...newReply, content: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700"
                  disabled={!newReply.name || !newReply.content || createMutation.isPending}
                  onClick={() => createMutation.mutate(newReply)}
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          className="pl-10"
          placeholder="Search auto replies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filtered?.length === 0 ? (
        <Card className="border-dashed flex flex-col items-center justify-center py-20">
          <MessageSquareReply className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No auto replies found</h3>
          <p className="text-gray-500">
            {isSuper ? "No auto replies have been created yet." : "Create your first auto reply to get started."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((reply) => (
            <Card key={reply.id} className="hover:shadow-md transition-shadow group relative">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold truncate">{reply.name}</CardTitle>
                {!isSuper && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title={reply.status === "active" ? "Deactivate" : "Activate"}
                      onClick={() =>
                        toggleMutation.mutate({
                          id: reply.id,
                          status: reply.status === "active" ? "inactive" : "active",
                        })
                      }
                    >
                      {reply.status === "active" ? (
                        <ToggleRight className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-400 hover:text-red-600"
                      onClick={() => deleteMutation.mutate(reply.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {isSuper && reply.ownerName && (
                  <div className="mb-3">
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 font-normal border-indigo-100">
                      Owner: {reply.ownerName}
                    </Badge>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px] border border-gray-100 italic">
                  "{reply.content}"
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <MessageSquareReply className="w-3 h-3" />
                    {new Date(reply.createdAt).toLocaleDateString()}
                  </span>
                  <Badge
                    variant="outline"
                    className={
                      reply.status === "active"
                        ? "text-green-600 border-green-200 bg-green-50"
                        : "text-gray-400 border-gray-200 bg-gray-50"
                    }
                  >
                    {reply.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
