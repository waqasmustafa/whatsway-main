import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, Smartphone, Signal, SignalLow, Loader2, QrCode as QrIcon } from "lucide-react";
import { io } from "socket.io-client";
import { useAuth } from "@/contexts/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import QRCode from "qrcode";

export default function DevicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState("");
  const [currentQr, setCurrentQr] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  const { data: devices, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-whatsapp/devices"],
  });

  useEffect(() => {
    if (!user) return;
    
    // Connect to socket for real-time QR/Status updates
    const newSocket = io({
      query: { userId: user.id }
    });
    setSocket(newSocket);

    newSocket.on("whatsapp_qr", (data: { deviceId: string, qr: string }) => {
      if (selectedDeviceId === data.deviceId) {
        QRCode.toDataURL(data.qr, { width: 300 }, (err, url) => {
          if (!err) setCurrentQr(url);
        });
      }
    });

    newSocket.on("whatsapp_status", (data: { deviceId: string, status: string, phoneNumber?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
      if (data.status === "connected" && selectedDeviceId === data.deviceId) {
        setIsQrModalOpen(false);
        toast({ title: "WhatsApp Connected!", description: "Device is now ready for campaigns." });
      }
    });

    return () => newSocket.disconnect();
  }, [user, selectedDeviceId]);

  const addDeviceMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/scan-whatsapp/devices", { name });
      return res.json();
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
      setIsAddModalOpen(false);
      setNewDeviceName("");
      // Automatically open QR modal for new device
      handleConnect(device.id);
    }
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/scan-whatsapp/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
      toast({ title: "Device Deleted" });
    }
  });

  const handleConnect = (id: string) => {
    setSelectedDeviceId(id);
    setCurrentQr(null);
    setIsQrModalOpen(true);
    apiRequest("POST", `/api/scan-whatsapp/devices/${id}/connect`);
  };

  const handleDisconnect = async (id: string) => {
    await apiRequest("POST", `/api/scan-whatsapp/devices/${id}/disconnect`);
    queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
    toast({ title: "Device Disconnected" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">WhatsApp <span className="text-blue-600">Devices</span></h1>
          <p className="text-slate-500 mt-1">Connect and manage your WhatsApp accounts for marketing campaigns.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Add New Device
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices?.map((device) => (
            <Card key={device.id} className="overflow-hidden border-slate-200 hover:border-blue-300 transition-colors">
              <CardHeader className="bg-slate-50/50 pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                    <Smartphone className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <Badge variant={device.status === "connected" ? "default" : "outline"} className={device.status === "connected" ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                      <Signal className="w-3 h-3 mr-1" />
                      {device.status === "connected" ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="mt-4 text-xl">{device.name}</CardTitle>
                <CardDescription>{device.phoneNumber || "No number linked"}</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex gap-2">
                {device.status !== "connected" ? (
                  <Button onClick={() => handleConnect(device.id)} className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 shadow-none">
                    <QrIcon className="w-4 h-4 mr-2" /> Scan QR
                  </Button>
                ) : (
                  <Button onClick={() => handleDisconnect(device.id)} variant="outline" className="flex-1 text-red-600 hover:bg-red-50 border-red-100">
                    <SignalLow className="w-4 h-4 mr-2" /> Disconnect
                  </Button>
                )}
                <Button 
                  onClick={() => deleteDeviceMutation.mutate(device.id)} 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                  disabled={deleteDeviceMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {devices?.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center space-y-4">
              <div className="p-4 bg-white rounded-full shadow-sm">
                <Smartphone className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-900 font-semibold">No devices added yet</p>
                <p className="text-slate-500 text-sm">Add your first WhatsApp device to start scanning.</p>
              </div>
              <Button onClick={() => setIsAddModalOpen(true)} variant="outline">
                Get Started
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Add Device Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New WhatsApp Device</DialogTitle>
            <DialogDescription>
              Give your device a name to identify it easily.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Device Name</Label>
              <Input
                id="name"
                placeholder="e.g. My Personal Phone"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={() => addDeviceMutation.mutate(newDeviceName)} disabled={!newDeviceName || addDeviceMutation.isPending}>
              {addDeviceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Device
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={isQrModalOpen} onOpenChange={(open) => {
        setIsQrModalOpen(open);
        if (!open) setCurrentQr(null);
      }}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Scan WhatsApp QR Code</DialogTitle>
            <DialogDescription>
              Open WhatsApp on your phone, tap Settings &gt; Linked Devices &gt; Link a Device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl relative min-h-[340px]">
            {currentQr ? (
              <img src={currentQr} alt="WhatsApp QR Code" className="w-64 h-64 rounded-xl shadow-lg border-4 border-white" />
            ) : (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
                <p className="text-sm text-slate-500 font-medium">Generating secure QR Code...</p>
              </div>
            )}
            {/* Overlay if connected while scanning */}
            {!isQrModalOpen && <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-2xl animate-in fade-in fill-mode-both duration-300">
               <div className="text-center">
                  <div className="bg-green-100 p-3 rounded-full inline-block mb-3">
                    <Signal className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="font-bold text-slate-900">Connected!</p>
               </div>
            </div>}
          </div>
          <Button variant="ghost" className="text-slate-400 mt-2" onClick={() => handleConnect(selectedDeviceId!)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh QR Code
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
