import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Megaphone, 
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

export default function ScanDashboard() {
  const { data: dashboardData, isLoading } = useQuery<any>({
    queryKey: ["/api/scan-dashboard/stats"],
  });

  const stats = [
    { 
      label: "Total Templates", 
      value: dashboardData?.stats?.templates || 0, 
      icon: FileText, 
      color: "text-purple-600", 
      bg: "bg-purple-50",
      link: "/scan-whatsapp/templates"
    },
    { 
      label: "Total Contacts", 
      value: dashboardData?.stats?.contacts || 0, 
      icon: Users, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      link: "/scan-whatsapp/contacts"
    },
    { 
      label: "Total Campaigns", 
      value: dashboardData?.stats?.campaigns || 0, 
      icon: Megaphone, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      link: "/scan-whatsapp/campaigns"
    },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <LayoutDashboard className="w-8 h-8 text-green-600" />
          WhatsApp Scan Dashboard
        </h1>
        <p className="text-gray-500 mt-1">Overview of your scanned accounts and active campaigns.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="hover:shadow-lg transition-all duration-300 border-none shadow-sm overflow-hidden group">
            <Link href={stat.link}>
              <CardContent className="p-6 cursor-pointer relative">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-4xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                    <stat.icon className="w-8 h-8" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                  View Details <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-gray-600" />
                Connected Devices
              </CardTitle>
              <CardDescription>Manage your linked WhatsApp accounts.</CardDescription>
            </div>
            <Link href="/scan-whatsapp/devices">
              <Button variant="outline" size="sm">Manage Devices</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead>Device Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><div className="h-4 bg-gray-100 animate-pulse rounded w-24"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-100 animate-pulse rounded w-32"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-100 animate-pulse rounded w-20"></div></TableCell>
                      <TableCell><div className="h-4 bg-gray-100 animate-pulse rounded w-24"></div></TableCell>
                    </TableRow>
                  ))
                ) : dashboardData?.devices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-gray-500">
                      No devices linked yet. 
                      <Link href="/scan-whatsapp/devices" className="text-green-600 font-medium ml-1">Add your first device</Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboardData?.devices?.map((device: any) => (
                    <TableRow key={device.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-semibold text-gray-900">{device.name}</TableCell>
                      <TableCell className="text-gray-600">{device.phoneNumber || "Not linked"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          device.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {device.status === 'connected' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {device.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Never"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
