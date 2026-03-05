import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { MessageSquare, Users, CheckCircle, AlertCircle, BarChart3 } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  status: string;
  templateName?: string;
  recipientCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  repliedCount?: number;
  failedCount?: number;
  createdAt: string;
  completedAt?: string;
  scheduledAt?: string;
}

interface CampaignDetailsDialogProps {
  campaign: Campaign | null;
  onClose: () => void;
}

export function CampaignDetailsDialog({ campaign, onClose }: CampaignDetailsDialogProps) {
  if (!campaign) return null;

  const deliveryRate = campaign.recipientCount && campaign.recipientCount > 0
    ? Math.round((campaign.deliveredCount || 0) / campaign.recipientCount * 100)
    : 0;

  const readRate = campaign.deliveredCount && campaign.deliveredCount > 0
    ? Math.round((campaign.readCount || 0) / campaign.deliveredCount * 100)
    : 0;

  const replyRate = campaign.readCount && campaign.readCount > 0
    ? Math.round((campaign.repliedCount || 0) / campaign.readCount * 100)
    : 0;

  // Prepare data for pie chart
  const statusData = [
    { name: 'Read', value: campaign.readCount || 0, color: '#3b82f6' },
    { name: 'Failed', value: campaign.failedCount || 0, color: '#ef4444' },
  ].filter(item => item.value > 0);

  return (
    <Dialog open={!!campaign} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{campaign.name}</span>
            <Badge variant={campaign.status === 'active' ? 'destructive' : 'default'}>
              {campaign.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="metrics">Detailed Metrics</TabsTrigger>
            <TabsTrigger value="report">Full Report</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Recipients</p>
                      <p className="text-xl font-bold">{campaign.recipientCount || 0}</p>
                    </div>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Sent</p>
                      <p className="text-xl font-bold">{campaign.sentCount || 0}</p>
                    </div>
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>



              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <p className="text-xl font-bold text-destructive">{campaign.failedCount || 0}</p>
                    </div>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Progress Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">


                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Read Rate</span>
                    <span className="text-sm font-bold text-blue-600">{readRate}%</span>
                  </div>
                  <Progress value={readRate} className="h-2" />
                </div>


              </CardContent>
            </Card>

            {/* Campaign Details */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Template</span>
                  <span className="text-sm font-medium">{campaign.templateName || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm font-medium">
                    {format(new Date(campaign.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                {campaign.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="text-sm font-medium">
                      {format(new Date(campaign.completedAt), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Message Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Full Campaign Report</CardTitle>
                <CardDescription>
                  View comprehensive analytics and download detailed reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href={`/analytics/campaign/${campaign.id}`}>
                  <Button className="w-full">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Full Analytics Report
                  </Button>
                </Link>
                <p className="text-sm text-muted-foreground text-center">
                  Access detailed analytics, timeline, recipient details, and more
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}