import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Send, 
  Loader2, 
  User, 
  Smartphone,
  ChevronLeft,
  MoreVertical,
  Check,
  CheckCheck,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  Video as VideoIcon,
  Download,
  ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { socket } from "@/lib/socket";
import { useAuth } from "@/contexts/auth-context";

export default function ScanInbox() {
  const { user } = useAuth();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: loadingConvs } = useQuery<any[]>({
    queryKey: ["/api/scan-inbox/conversations"],
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery<any[]>({
    queryKey: ["/api/scan-inbox/messages", selectedConvId],
    enabled: !!selectedConvId,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { conversationId: string, text: string, media?: any }) => {
      return await apiRequest("POST", "/api/scan-inbox/send", data);
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/messages", selectedConvId] });
      queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/conversations"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("DELETE", "/api/scan-inbox/conversations", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/conversations"] });
      setSelectedConvIds(new Set());
      if (selectedConvId && Array.from(selectedConvIds).includes(selectedConvId)) {
        setSelectedConvId(null);
      }
      toast({ title: "Deleted", description: "Conversations removed successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  // Handle live updates
  useEffect(() => {
    if (!user?.id) return;

    console.log("[Inbox] Connecting to socket room for user:", user.id);
    // Join user-specific room for scan notifications
    socket.emit("join_scan_user", { userId: user.id });

    const handleNewMessage = (data: any) => {
      console.log("[Inbox] Real-time message received:", data);
      // 1. Always refresh conversation list for sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/conversations"] });
      
      // 2. Also refresh global unread count
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });

      // 3. If the message belongs to the currently open chat, refresh messages
      if (data.conversation.id === selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/messages", selectedConvId] });
      }
    };

    socket.on("scan_new_message", handleNewMessage);
    
    socket.on("connect", () => {
      console.log("[Inbox] Socket connected:", socket.id);
      socket.emit("join_scan_user", { userId: user.id });
    });

    socket.on("disconnect", (reason) => {
      console.warn("[Inbox] Socket disconnected:", reason);
    });

    return () => {
      socket.off("scan_new_message", handleNewMessage);
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [selectedConvId, queryClient, user?.id]);

  // Reset unread count in UI immediately when selecting a conversation
  useEffect(() => {
    if (selectedConvId) {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-inbox/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
    }
  }, [selectedConvId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    if (messages?.length) {
      // Immediate scroll
      scrollToBottom();
      // Secondary scroll after a brief delay to ensure images/rendering is done
      const timer = setTimeout(scrollToBottom, 300);
      return () => clearTimeout(timer);
    }
  }, [messages, selectedConvId]);

  const toggleSelectAll = () => {
    if (selectedConvIds.size === filteredConvs?.length) {
      setSelectedConvIds(new Set());
    } else {
      setSelectedConvIds(new Set(filteredConvs?.map(c => c.id)));
    }
  };

  const toggleConversation = (id: string) => {
    const next = new Set(selectedConvIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedConvIds(next);
  };

  const filteredConvs = conversations?.filter(c => 
    c.remoteNumber.includes(searchTerm) || 
    c.deviceName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProxiedUrl = (url: string | null) => {
    if (!url) return '';
    if (url.includes('cloudflarestorage.com') || url.includes('digitaloceanspaces.com')) {
      return `/api/scan-inbox/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/scan-inbox/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const result = await response.json();

      if (result.success) {
        // Automatically send the media message
        sendMutation.mutate({
          conversationId: selectedConvId,
          text: "", // Empty text for pure media
          media: result.data
        });
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const selectedConv = conversations?.find(c => c.id === selectedConvId);

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      {/* Sidebar - Conversation List */}
      <div className={`w-full md:w-80 lg:w-96 border-r bg-white flex flex-col ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b space-y-4 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">WhatsApp Inbox</h2>
            {selectedConvIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 px-2"
                onClick={() => deleteMutation.mutate(Array.from(selectedConvIds))}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete ({selectedConvIds.size})
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search conversations..." 
              className="pl-10 bg-gray-50 border-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 pt-1 border-t mt-2">
            <Checkbox 
              id="select-all" 
              checked={filteredConvs?.length > 0 && selectedConvIds.size === filteredConvs.length}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-xs font-medium text-gray-500 cursor-pointer">
              Select All
            </label>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : filteredConvs?.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No conversations found.</div>
          ) : (
            filteredConvs?.map((conv) => (
              <div 
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors border-b relative group ${selectedConvId === conv.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedConvIds.has(conv.id)}
                      onCheckedChange={() => toggleConversation(conv.id)}
                    />
                  </div>
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-blue-100 text-blue-600 font-bold uppercase">
                      {conv.remoteNumber.slice(-2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-gray-900 truncate">+{conv.remoteNumber}</p>
                      <span className="text-[10px] text-gray-400">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-gray-50 text-gray-500 border-gray-200">
                        <Smartphone className="w-2.5 h-2.5 mr-1" /> {conv.deviceName}
                      </Badge>
                    </div>
                    <p className={`text-sm mt-1 truncate ${conv.unreadCount > 0 ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                      {conv.lastMessage}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {conv.unreadCount}
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate([conv.id]);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col bg-[#f0f2f5] ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="p-3 bg-white border-b flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedConvId(null)}>
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gray-100 text-gray-600 font-bold uppercase">
                    {selectedConv.remoteNumber.slice(-2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-gray-900">+{selectedConv.remoteNumber}</h3>
                  <p className="text-[11px] text-blue-600 font-medium flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                    Linked to: {selectedConv.deviceName} ({selectedConv.devicePhone})
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon"><MoreVertical className="w-5 h-5 text-gray-400" /></Button>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-6" viewportRef={scrollRef}>
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages?.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl p-2.5 shadow-sm relative ${
                      msg.direction === 'outbound' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                    }`}>
                      {/* Media Rendering */}
                      {msg.mediaUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg">
                          {msg.mediaType === 'image' || (msg.mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                            <img 
                              src={getProxiedUrl(msg.mediaUrl)} 
                              alt="attachment" 
                              className="max-w-full max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity mx-auto bg-black/5"
                              onClick={() => window.open(getProxiedUrl(msg.mediaUrl), '_blank')}
                            />
                          ) : msg.mediaType === 'video' ? (
                            <video controls className="max-w-full rounded-lg">
                              <source src={getProxiedUrl(msg.mediaUrl)} />
                            </video>
                          ) : (
                            <div className="flex items-center gap-3 p-3 bg-black/5 rounded-lg border border-black/10">
                              <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center text-white">
                                <FileIcon className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{msg.fileName || 'Document'}</p>
                                <p className="text-[10px] opacity-70">
                                  {msg.fileSize ? `${(msg.fileSize / 1024 / 1024).toFixed(2)} MB` : ''}
                                </p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-black/10"
                                onClick={() => window.open(getProxiedUrl(msg.mediaUrl), '_blank')}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed px-1">{msg.content}</p>}
                      
                      <div className={`flex items-center justify-end gap-1 mt-1.5 ${msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-400'}`}>
                        <span className="text-[10px]">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.direction === 'outbound' && (
                          msg.status === 'sent' ? <Check className="w-3 h-3" /> : <CheckCheck className="w-3 h-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-1" />
                {loadingMsgs && <div className="flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 bg-white border-t">
              <div className="max-w-5xl mx-auto flex gap-2 items-end">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept="image/*,video/*,.pdf,.doc,.docx"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50 mb-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || sendMutation.isPending}
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </Button>
                <Textarea 
                  placeholder="Type a message... (Shift + Enter for new line)" 
                  className="flex-1 bg-gray-50 border-none focus-visible:ring-blue-500 min-h-[44px] max-h-[150px] resize-none py-3"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (replyText.trim() && !sendMutation.isPending) {
                        sendMutation.mutate({ conversationId: selectedConv.id, text: replyText });
                      }
                    }
                  }}
                  disabled={sendMutation.isPending}
                />
                <Button 
                  onClick={() => {
                    if (replyText.trim()) sendMutation.mutate({ conversationId: selectedConv.id, text: replyText });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0 rounded-full flex-shrink-0 mb-1"
                  disabled={!replyText.trim() || sendMutation.isPending}
                >
                  {sendMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-600">Select a conversation</h3>
            <p className="max-w-xs mt-2">Pick a chat from the sidebar to start messaging across your scanned accounts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
