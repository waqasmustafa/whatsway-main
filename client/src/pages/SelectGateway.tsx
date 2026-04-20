import React from "react";
import { useLocation } from "wouter";
import { QrCode, Webhook, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function SelectGateway() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSelect = (mode: "webhook" | "scan") => {
    if (mode === "scan") {
      toast({
        title: "Scanning Gateway",
        description: "Working on it... This feature is coming soon!",
      });
      // For now, we still allow selecting it but it will redirect to a placeholder
      localStorage.setItem("gateway_mode", "scan");
      window.location.href = "/scan-whatsapp/dashboard";
    } else {
      localStorage.setItem("gateway_mode", "webhook");
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Select Your <span className="text-green-600">Gateway</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Choose how you want to connect and manage your WhatsApp marketing campaigns today.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          {/* Webhook Gateway */}
          <Card 
            className="group cursor-pointer overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
            onClick={() => handleSelect("webhook")}
          >
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-8 flex flex-col items-center text-white space-y-4 h-full min-h-[320px] justify-center">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                  <Webhook className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Webhook Gateway</h2>
                  <p className="text-green-50/90 text-sm">
                    Connect via official WhatsApp Cloud API. Secure, stable, and scalable for business operations.
                  </p>
                </div>
                <Button variant="secondary" className="bg-white text-emerald-700 hover:bg-emerald-50 border-none px-8 font-semibold">
                  Enter Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scan Gateway */}
          <Card 
            className="group cursor-pointer overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
            onClick={() => handleSelect("scan")}
          >
            <CardContent className="p-0">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-8 flex flex-col items-center text-white space-y-4 h-full min-h-[320px] justify-center text-center">
                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                  <QrCode className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Scan WhatsApp</h2>
                  <p className="text-blue-50/90 text-sm">
                    Connect by scanning a QR code. Direct connection to your mobile device for quick setup.
                  </p>
                </div>
                <div className="mt-4 px-4 py-1.5 bg-yellow-400/90 text-amber-900 text-[10px] font-bold uppercase tracking-wider rounded-full self-center">
                  Working On It
                </div>
                <Button variant="secondary" className="bg-white text-indigo-700 hover:bg-indigo-50 border-none px-8 font-semibold">
                  Launch Scan <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="pt-8 text-slate-400 text-sm">
          You can switch between gateways anytime from the sidebar settings.
        </p>
      </div>
    </div>
  );
}
