import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, RefreshCw, Trash2, Smartphone, Signal, SignalLow, Loader2, QrCode as QrIcon, Globe, ChevronDown, ChevronUp } from "lucide-react";
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
  const [showProxyFields, setShowProxyFields] = useState(false);
  const [proxyHost, setProxyHost] = useState("");
  const [proxyPort, setProxyPort] = useState("");
  const [proxyUsername, setProxyUsername] = useState("");
  const [proxyPassword, setProxyPassword] = useState("");
   const [currentQr, setCurrentQr] = useState<string | null>(null);
   const [pairingCode, setPairingCode] = useState<string | null>(null);
   const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
   const [socket, setSocket] = useState<any>(null);
   const [phoneNumber, setPhoneNumber] = useState("");
   const [showPairing, setShowPairing] = useState(false);
   const [isConnecting, setIsConnecting] = useState(false);

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
        setPairingCode(null);
        setIsConnecting(false);
        QRCode.toDataURL(data.qr, { width: 300 }, (err, url) => {
          if (!err) setCurrentQr(url);
        });
      }
    });

    newSocket.on("whatsapp_pairing_code", (data: { deviceId: string, code: string }) => {
      if (selectedDeviceId === data.deviceId) {
        setPairingCode(data.code);
        setCurrentQr(null);
        setIsConnecting(false);
      }
    });

    newSocket.on("whatsapp_status", (data: { deviceId: string, status: string, phoneNumber?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
      if (data.status === "connected" && selectedDeviceId === data.deviceId) {
        setIsQrModalOpen(false);
        toast({ title: "WhatsApp Connected!", description: "Device is now ready for campaigns." });
      }
    });

    newSocket.on("whatsapp_error", (data: { deviceId: string, message: string }) => {
      if (selectedDeviceId === data.deviceId) {
        setIsConnecting(false);
        toast({ 
          title: "Connection Error", 
          description: data.message,
          variant: "destructive" 
        });
      }
    });

    return () => newSocket.disconnect();
  }, [user, selectedDeviceId]);

  const addDeviceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/scan-whatsapp/devices", {
        name: newDeviceName,
        proxyHost: proxyHost || undefined,
        proxyPort: proxyPort || undefined,
        proxyUsername: proxyUsername || undefined,
        proxyPassword: proxyPassword || undefined,
      });
      return res.json();
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ["/api/scan-whatsapp/devices"] });
      setIsAddModalOpen(false);
      setNewDeviceName("");
      setProxyHost(""); setProxyPort(""); setProxyUsername(""); setProxyPassword("");
      setShowProxyFields(false);
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

  const handleConnect = async (id: string, phone?: string) => {
    setSelectedDeviceId(id);
    setCurrentQr(null);
    setPairingCode(null);
    setIsQrModalOpen(true);
    setIsConnecting(true);
    try {
      await apiRequest("POST", `/api/scan-whatsapp/devices/${id}/connect`, phone ? { phoneNumber: phone } : {});
    } finally {
      // We keep isConnecting true until we get a QR or Code via socket
    }
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
                    {device.proxyHost && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">
                        <Globe className="w-3 h-3 mr-1" /> Proxy
                      </Badge>
                    )}
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
      <Dialog open={isAddModalOpen} onOpenChange={(open) => {
        setIsAddModalOpen(open);
        if (!open) {
          setNewDeviceName(""); setProxyHost(""); setProxyPort("");
          setProxyUsername(""); setProxyPassword(""); setShowProxyFields(false);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New WhatsApp Device</DialogTitle>
            <DialogDescription>Give your device a name to identify it easily.</DialogDescription>
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

            {/* Proxy Settings (Optional) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                onClick={() => setShowProxyFields(!showProxyFields)}
              >
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" />
                  Proxy Settings <span className="text-slate-400 font-normal">(Optional)</span>
                </div>
                {showProxyFields ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showProxyFields && (
                <div className="p-4 space-y-3 bg-white">
                  <p className="text-xs text-slate-500">Recommended to avoid IP bans if linking multiple accounts.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Proxy Host (SOCKS5)</Label>
                      <Input placeholder="e.g. 1.2.3.4" value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Port</Label>
                      <Input placeholder="1080" value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Username</Label>
                      <Input placeholder="Proxy username" value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wide">Password</Label>
                      <Input type="password" placeholder="••••••••" value={proxyPassword} onChange={(e) => setProxyPassword(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={() => addDeviceMutation.mutate()} disabled={!newDeviceName || addDeviceMutation.isPending}>
              {addDeviceMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Device
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={isQrModalOpen} onOpenChange={(open) => {
        setIsQrModalOpen(open);
        if (!open) {
          setCurrentQr(null);
          setPairingCode(null);
          setShowPairing(false);
          setPhoneNumber("");
        }
      }}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Link WhatsApp Device</DialogTitle>
            <DialogDescription>
              Choose your preferred linking method below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl relative min-h-[360px] border border-slate-100">
            {!showPairing ? (
              // QR Code Section
              <div className="space-y-6 w-full">
                {currentQr ? (
                  <div className="space-y-4">
                    <img src={currentQr} alt="WhatsApp QR Code" className="w-64 h-64 mx-auto rounded-xl shadow-lg border-4 border-white" />
                    <p className="text-sm text-slate-500">Scan this QR code with your WhatsApp app.</p>
                  </div>
                ) : (
                  <div className="space-y-4 py-12">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-500" />
                    <p className="text-sm text-slate-500 font-medium">Generating secure QR Code...</p>
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-200">
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setShowPairing(true)}>
                    <Smartphone className="w-4 h-4 mr-2" /> Link with phone number instead
                  </Button>
                </div>
              </div>
            ) : (
              // Pairing Code Section
              <div className="space-y-6 w-full max-w-sm mx-auto">
                {!pairingCode ? (
                  <div className="space-y-4 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="e.g. 923001234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                      <p className="text-xs text-slate-500">Include country code without + (e.g. 92 for Pakistan)</p>
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700" 
                      onClick={() => handleConnect(selectedDeviceId!, phoneNumber)}
                      disabled={!phoneNumber || isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                        </>
                      ) : (
                        "Get Pairing Code"
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-6 bg-white rounded-2xl border-2 border-blue-100 shadow-inner">
                      <div className="text-4xl font-mono font-bold tracking-[0.5em] text-blue-700">
                        {pairingCode}
                      </div>
                    </div>
                    <div className="space-y-3 text-sm text-slate-600 text-left bg-blue-50/50 p-4 rounded-xl border border-blue-50">
                      <p className="font-semibold text-blue-800">How to use:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap <b>Settings</b> &gt; <b>Linked Devices</b></li>
                        <li>Tap <b>Link a Device</b></li>
                        <li>Tap <b>Link with phone number instead</b></li>
                        <li>Enter the code shown above</li>
                      </ol>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-200">
                  <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={() => {
                    setShowPairing(false);
                    setPairingCode(null);
                    setPhoneNumber("");
                    handleConnect(selectedDeviceId!); // Restart with QR
                  }}>
                    <QrIcon className="w-4 h-4 mr-2" /> Back to QR Code
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <Button variant="ghost" className="text-slate-400 mt-2" onClick={() => handleConnect(selectedDeviceId!, showPairing ? phoneNumber : undefined)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh {showPairing ? "Code" : "QR"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
