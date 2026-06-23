import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Trash2,
  Play,
  Pause,
  Loader2,
  LayoutList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  FileText,
  MessageSquareReply,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";

export default function ScanCampaigns() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    templateIds: [] as string[],
    deviceIds: [] as string[],
    contactListId: "",
    minDelay: 5,
    maxDelay: 15,
    autoReplyEnabled: false,
    autoReplyDelay: 30,
    autoReplyMessageIds: [] as string[],
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: campaigns, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-campaigns"],
    refetchInterval: (query) => {
      // Refetch every 3 seconds if any campaign is running
      return query.state.data?.some((c: any) => c.status === 'running') ? 3000 : false;
    }
  });

  const { data: templates } = useQuery<any[]>({ queryKey: ["/api/scan-templates"] });
  const { data: devices } = useQuery<any[]>({ queryKey: ["/api/scan-whatsapp/devices"] });
  const { data: contactLists } = useQuery<any[]>({ queryKey: ["/api/scan-contacts"] });
  const { data: autoReplies } = useQuery<any[]>({ queryKey: ["/api/scan-auto-replies"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/scan-campaigns", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-campaigns"] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: "Success", description: "Campaign created as draft" });
    }
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/scan-campaigns/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-campaigns"] });
      toast({ title: "Started", description: "Campaign is now running" });
    }
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/scan-campaigns/${id}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-campaigns"] });
      toast({ title: "Paused", description: "Campaign paused" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scan-campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-campaigns"] });
      toast({ title: "Deleted", description: "Campaign removed" });
    }
  });

  const resetForm = () => {
    setNewCampaign({
      name: "",
      templateIds: [],
      deviceIds: [],
      contactListId: "",
      minDelay: 5,
      maxDelay: 15,
      autoReplyEnabled: false,
      autoReplyDelay: 30,
      autoReplyMessageIds: [],
    });
  };

  const toggleTemplate = (id: string) => {
    setNewCampaign(prev => ({
      ...prev,
      templateIds: prev.templateIds.includes(id) 
        ? prev.templateIds.filter(t => t !== id)
        : [...prev.templateIds, id]
    }));
  };

  const toggleDevice = (id: string) => {
    setNewCampaign(prev => ({
      ...prev,
      deviceIds: prev.deviceIds.includes(id)
        ? prev.deviceIds.filter(d => d !== id)
        : [...prev.deviceIds, id]
    }));
  };

  const toggleAutoReplyMessage = (id: string) => {
    setNewCampaign(prev => ({
      ...prev,
      autoReplyMessageIds: prev.autoReplyMessageIds.includes(id)
        ? prev.autoReplyMessageIds.filter(r => r !== id)
        : [...prev.autoReplyMessageIds, id]
    }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {isSuper ? "Master Campaigns" : "WhatsApp Campaigns"}
          </h1>
          <p className="text-gray-500">
            {isSuper ? "Monitoring active and past campaigns across all platform accounts." : "Run automated marketing campaigns with device rotation."}
          </p>
        </div>

        {!isSuper && (
          <Dialog open={isModalOpen} onOpenChange={(open) => { setIsModalOpen(open); if(!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-2" /> Create New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Launch New Campaign</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Campaign Name</label>
                    <Input 
                      placeholder="e.g. Eid Discount Blast" 
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({...newCampaign, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Contact List</label>
                    <Select 
                      value={newCampaign.contactListId} 
                      onValueChange={(val) => setNewCampaign({...newCampaign, contactListId: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent>
                        {contactLists?.map(list => (
                          <SelectItem key={list.id} value={list.id}>
                            {list.name} ({list.phoneNumbers?.length || 0} contacts)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-xs">Min Delay (sec)</label>
                      <Input 
                        type="number" 
                        value={newCampaign.minDelay}
                        onChange={(e) => setNewCampaign({...newCampaign, minDelay: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-xs">Max Delay (sec)</label>
                      <Input 
                        type="number" 
                        value={newCampaign.maxDelay}
                        onChange={(e) => setNewCampaign({...newCampaign, maxDelay: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between">
                      Select Templates 
                      <span className="text-xs text-orange-600 font-normal">Rotation active</span>
                    </label>
                    <Card className="border-gray-200">
                      <ScrollArea className="h-[120px] p-2">
                        {templates?.map(t => (
                          <div key={t.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                            <Checkbox 
                              id={`t-${t.id}`} 
                              checked={newCampaign.templateIds.includes(t.id)}
                              onCheckedChange={() => toggleTemplate(t.id)}
                            />
                            <label htmlFor={`t-${t.id}`} className="text-sm truncate cursor-pointer">{t.name}</label>
                          </div>
                        ))}
                        {(!templates || templates.length === 0) && <p className="text-xs text-gray-400 p-2 text-center">No templates found</p>}
                      </ScrollArea>
                    </Card>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between">
                      Select Devices 
                      <span className="text-xs text-blue-600 font-normal">Rotation active</span>
                    </label>
                    <Card className="border-gray-200">
                      <ScrollArea className="h-[120px] p-2">
                        {devices?.filter(d => d.status === 'connected').map(d => (
                          <div key={d.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                            <Checkbox 
                              id={`d-${d.id}`} 
                              checked={newCampaign.deviceIds.includes(d.id)}
                              onCheckedChange={() => toggleDevice(d.id)}
                            />
                            <label htmlFor={`d-${d.id}`} className="text-sm truncate cursor-pointer">
                              {d.name} ({d.phoneNumber})
                            </label>
                          </div>
                        ))}
                        {devices?.filter(d => d.status === 'connected').length === 0 && (
                          <p className="text-xs text-gray-400 p-2 text-center">No connected devices found</p>
                        )}
                      </ScrollArea>
                    </Card>
                  </div>
                </div>
              </div>
              {/* Auto Reply Settings */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquareReply className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium">Auto Reply</span>
                  </div>
                  <Switch
                    checked={newCampaign.autoReplyEnabled}
                    onCheckedChange={(val) => setNewCampaign({ ...newCampaign, autoReplyEnabled: val })}
                  />
                </div>

                {newCampaign.autoReplyEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-indigo-100">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reply Delay (minutes)</label>
                      <Input
                        type="number"
                        min={0}
                        value={newCampaign.autoReplyDelay}
                        onChange={(e) =>
                          setNewCampaign({ ...newCampaign, autoReplyDelay: parseInt(e.target.value) || 0 })
                        }
                        placeholder="e.g. 30"
                      />
                      <p className="text-xs text-gray-400">
                        Auto reply will be sent this many minutes after the contact replies.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium flex justify-between">
                        Select Auto Reply Messages
                        <span className="text-xs text-indigo-600 font-normal">Round-robin active</span>
                      </label>
                      <Card className="border-gray-200">
                        <ScrollArea className="h-[110px] p-2">
                          {autoReplies?.filter(r => r.status === "active").map(r => (
                            <div key={r.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                              <Checkbox
                                id={`ar-${r.id}`}
                                checked={newCampaign.autoReplyMessageIds.includes(r.id)}
                                onCheckedChange={() => toggleAutoReplyMessage(r.id)}
                              />
                              <label htmlFor={`ar-${r.id}`} className="text-sm truncate cursor-pointer">
                                {r.name}
                              </label>
                            </div>
                          ))}
                          {(!autoReplies || autoReplies.filter(r => r.status === "active").length === 0) && (
                            <p className="text-xs text-gray-400 p-2 text-center">
                              No active auto replies. Create some in Auto Message Reply.
                            </p>
                          )}
                        </ScrollArea>
                      </Card>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={
                    !newCampaign.name ||
                    newCampaign.templateIds.length === 0 ||
                    newCampaign.deviceIds.length === 0 ||
                    !newCampaign.contactListId ||
                    (newCampaign.autoReplyEnabled && newCampaign.autoReplyMessageIds.length === 0) ||
                    createMutation.isPending
                  }
                  onClick={() => createMutation.mutate(newCampaign)}
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      ) : campaigns?.length === 0 ? (
        <Card className="border-dashed flex flex-col items-center justify-center py-20">
          <Megaphone className="w-12 h-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No campaigns found</h3>
          <p className="text-gray-500">Create your first campaign to reach your customers.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {campaigns?.map((campaign) => {
            const progress = campaign.totalRecipients > 0 
              ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
              : 0;
            
            return (
              <Card key={campaign.id} className="overflow-hidden border-l-4 border-l-orange-500 hover:shadow-md transition-shadow relative">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-gray-900">{campaign.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          campaign.status === 'running' ? 'bg-green-100 text-green-700' :
                          campaign.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                          campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {campaign.status}
                        </span>
                        {isSuper && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 font-normal border-orange-100">
                            Owner: {campaign.ownerName || "Unknown"}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span className="flex items-center"><Smartphone className="w-4 h-4 mr-1" /> {campaign.deviceIds?.length || 0} Devices</span>
                        <span className="flex items-center"><FileText className="w-4 h-4 mr-1" /> {campaign.templateIds?.length || 0} Templates</span>
                        <span className="flex items-center"><LayoutList className="w-4 h-4 mr-1" /> {campaign.totalRecipients} Contacts</span>
                        <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {campaign.minDelay}-{campaign.maxDelay}s delay</span>
                      </div>

                      <div className="w-full max-w-md pt-2">
                        <div className="flex justify-between text-xs mb-1 font-medium">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-orange-50" />
                        <div className="flex gap-4 mt-2 text-xs font-medium">
                          <span className="text-green-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> {campaign.sentCount} Sent</span>
                          <span className="text-red-600 flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> {campaign.failedCount} Failed</span>
                          <span className="text-gray-400">Total: {campaign.totalRecipients}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {campaign.status === 'draft' || campaign.status === 'paused' ? (
                        <Button 
                          onClick={() => startMutation.mutate(campaign.id)}
                          className="bg-green-600 hover:bg-green-700"
                          disabled={startMutation.isPending}
                        >
                          <Play className="w-4 h-4 mr-2" /> Start
                        </Button>
                      ) : campaign.status === 'running' ? (
                        <Button 
                          onClick={() => pauseMutation.mutate(campaign.id)}
                          variant="outline"
                          className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                          disabled={pauseMutation.isPending}
                        >
                          <Pause className="w-4 h-4 mr-2" /> Pause
                        </Button>
                      ) : null}

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => deleteMutation.mutate(campaign.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
