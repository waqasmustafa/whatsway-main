import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  History,
  Search,
  Loader2,
  Smartphone,
  Megaphone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Globe
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";

export default function ScanLogs() {
  const { user } = useAuth();
  const isSuper = user?.role === "superadmin";

  const [searchTerm, setSearchTerm] = useState("");

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/scan-logs"],
    refetchInterval: 5000, // Refresh logs every 5 seconds to show real-time progress
  });

  const filteredLogs = logs?.filter(log =>
    log.receiverNumber.includes(searchTerm) ||
    log.campaignName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.deviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.proxyHost?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.ownerName && log.ownerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-8 h-8 text-gray-600" />
            {isSuper ? "Master Message Logs" : "Message Logs"}
          </h1>
          <p className="text-gray-500">
            {isSuper ? "Monitoring messaging history across all platform accounts." : "History of all messages sent via scanned accounts."}
          </p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            className="pl-10 text-gray-900" 
            placeholder="Search number, campaign, device or owner..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead>Receiver</TableHead>
                {isSuper && <TableHead>Owner</TableHead>}
                <TableHead>Campaign</TableHead>
                <TableHead>Sender Device</TableHead>
                <TableHead>Proxy IP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message Preview</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={isSuper ? 7 : 6}><div className="h-8 bg-gray-50 animate-pulse rounded w-full"></div></TableCell>
                  </TableRow>
                ))
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSuper ? 8 : 7} className="text-center py-20 text-gray-500">
                    <div className="flex flex-col items-center">
                      <History className="w-12 h-12 text-gray-200 mb-2" />
                      <p>No message logs found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map((log) => (
                  <TableRow key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-medium text-gray-900">+{log.receiverNumber}</TableCell>
                    {isSuper && (
                      <TableCell>
                        <Badge variant="outline" className="bg-gray-50 font-normal">
                          {log.ownerName || "Unknown"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center text-xs text-gray-600">
                        <Megaphone className="w-3 h-3 mr-1 text-orange-500" />
                        {log.campaignName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs text-gray-600">
                        <Smartphone className="w-3 h-3 mr-1 text-blue-500" />
                        {log.deviceName || "Pending..."}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.proxyHost ? (
                        <div className="flex items-center text-xs text-purple-600">
                          <Globe className="w-3 h-3 mr-1" />
                          {log.proxyHost}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sent
                          </span>
                        ) : log.status === 'failed' ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 cursor-help">
                                  <XCircle className="w-3 h-3 mr-1" /> Failed
                                  <AlertCircle className="w-3 h-3 ml-1 opacity-50" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{log.errorReason || "Unknown error"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-gray-500 truncate max-w-[200px] italic">
                        {log.content || "Generating content..."}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 text-[10px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
