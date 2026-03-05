import { Card, CardContent } from "@/components/ui/card";
import {
  MessageSquare,
  Users,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
interface Campaign {
  id: string;
  status: string;
  recipientCount?: number;
  sentCount?: number;
  deliveredCount?: number;
  readCount?: number;
  failedCount?: number;
}

export interface CampaignStatisticsProps {
  campaigns: Campaign[];
}

export function CampaignStatistics({ campaigns }: CampaignStatisticsProps) {
  // Calculate aggregate statistics

  const { t } = useTranslation();
  const stats = campaigns.reduce(
    (acc, campaign) => ({
      totalCampaigns: acc.totalCampaigns + 1,
      activeCampaigns:
        acc.activeCampaigns + (campaign.status === "active" ? 1 : 0),
      totalRecipients: acc.totalRecipients + (campaign.recipientCount || 0),
      totalSent: acc.totalSent + (campaign.sentCount || 0),
      totalRead: acc.totalRead + (campaign.readCount || 0),
      totalFailed: acc.totalFailed + (campaign.failedCount || 0),
    }),
    {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalRecipients: 0,
      totalSent: 0,
      totalRead: 0,
      totalFailed: 0,
    }
  );

  const readRate =
    stats.totalSent > 0
      ? Math.round((stats.totalRead / stats.totalSent) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("campaigns.totalCampaigns")}
              </p>
              <p className="text-2xl font-bold">{stats.totalCampaigns}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeCampaigns} {t("campaigns.active")}
              </p>
            </div>
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("campaigns.totalRecipients")}
              </p>
              <p className="text-2xl font-bold">
                {stats.totalRecipients.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalSent} {t("campaigns.sent")}
              </p>
            </div>
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("campaigns.readRate")}
              </p>
              <p className="text-2xl font-bold text-blue-600">{readRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalRead} {t("campaigns.read")}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("campaigns.failedMessages")}
              </p>
              <p className="text-2xl font-bold text-destructive">
                {stats.totalFailed}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalSent > 0
                  ? Math.round((stats.totalFailed / stats.totalSent) * 100)
                  : 0}
                % {t("campaigns.failedRate")}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
        </CardContent>
      </Card>
    </div >
  );
}
