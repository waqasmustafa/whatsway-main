import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Loader2, 
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ScanTemplates() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "" });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/scan-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-templates"] });
      setIsModalOpen(false);
      setNewTemplate({ name: "", content: "" });
      toast({ title: "Success", description: "Template created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scan-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-templates"] });
      toast({ title: "Deleted", description: "Template removed" });
    }
  });

  const filteredTemplates = templates?.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Templates</h1>
          <p className="text-gray-500">Create and manage message templates for scanned accounts.</p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Create New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input 
                  placeholder="e.g. Welcome Message" 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message Content</label>
                <Textarea 
                  placeholder="Type your message here..." 
                  className="min-h-[150px]"
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!newTemplate.name || !newTemplate.content || createMutation.isPending}
                onClick={() => createMutation.mutate(newTemplate)}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input 
          className="pl-10" 
          placeholder="Search templates..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : filteredTemplates?.length === 0 ? (
        <Card className="border-dashed flex flex-col items-center justify-center py-20">
          <FileText className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No templates found</h3>
          <p className="text-gray-500">Create your first template to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates?.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold truncate">{template.name}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteMutation.mutate(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px] border border-gray-100 italic">
                  "{template.content}"
                </div>
                <div className="mt-4 flex items-center text-xs text-gray-400">
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Created on {new Date(template.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
