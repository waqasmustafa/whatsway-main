import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import type { DashboardStats } from "@/types/types";
import { CardStat } from "./CardStat";
import { useTranslation } from "@/lib/i18n";

// Define different icons for each card
const ContactsIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TemplatesIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ChannelsIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </svg>
);

const MessagesIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const TeamMembersIcon = (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"
    />
    <circle cx="9" cy="7" r="4" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M23 20v-2a4 4 0 0 0-3-3.87"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 3.13a4 4 0 0 1 0 7.75"
    />
  </svg>
);

const UsersIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CampaignsIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SignupsIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const TrendingIcon = (
  <svg
    className="w-6 h-6"
    stroke="currentColor"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="2"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

export default function AdminStats() {
  const { user } = useAuth();

  const { t } = useTranslation();

  const { data: activeChannel } = useQuery({
    queryKey: ["/api/channels/active"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/channels/active");
      if (!response.ok) return null;
      return await response.json();
    },
  });

  // const { data: stats, isLoading } = useQuery<DashboardStats>({
  //   queryKey: [
  //     user?.role === "admin" || "team"
  //       ? `/api/dashboard/user/statss?channelId=${activeChannel?.id}`
  //       : "/api/dashboard/admin/stats",
  //   ],
  //   queryFn: () =>
  //     apiRequest(
  //       "GET",
  //       user?.role === "admin" || "team"
  //         ? `/api/dashboard/user/statss?channelId=${activeChannel?.id}`
  //         : "/api/dashboard/admin/stats"
  //     ).then((res) => res.json()),
  // });


  const isTeamOrAdmin =
    user?.role === "team" || user?.role === "admin";

  const url = isTeamOrAdmin
    ? `/api/dashboard/user/statss?channelId=${activeChannel?.id}`
    : "/api/dashboard/admin/stats";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: [url],
    queryFn: () => apiRequest("GET", url).then((res) => res.json()),
  });


  // Loading skeleton
  if (isLoading) {
    return (
      <div className="container mx-auto">
        <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="px-4 py-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Total Contacts */}
        {stats &&
          stats.totalContacts !== undefined &&
          stats.totalContacts !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Contacts")}
              value={stats.totalContacts}
              icon={ContactsIcon}
              iconClassName="bg-blue-50 text-blue-600"
              borderColor="border-l-blue-500"
            />
          )}

        {/* Total Templates */}
        {stats &&
          stats.totalTemplates !== undefined &&
          stats.totalTemplates !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Templates")}
              value={stats.totalTemplates}
              icon={TemplatesIcon}
              iconClassName="bg-purple-50 text-purple-600"
              borderColor="border-l-purple-500"
            />
          )}

        {/* Total Channels */}
        {stats &&
          stats.totalChannels !== undefined &&
          stats.totalChannels !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Channels")}
              value={stats.totalChannels}
              icon={ChannelsIcon}
              iconClassName="bg-green-50 text-green-600"
              borderColor="border-l-green-500"
            />
          )}

        {/* Total Messages */}
        {stats &&
          stats.totalMessages !== undefined &&
          stats.totalMessages !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Messages")}
              value={stats.totalMessages}
              icon={MessagesIcon}
              iconClassName="bg-orange-50 text-orange-600"
              borderColor="border-l-orange-500"
            />
          )}

        {stats &&
          stats.totalTemplatesByUserId !== undefined &&
          stats.totalTemplatesByUserId !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Templates")}
              value={stats.totalTemplatesByUserId}
              icon={TeamMembersIcon}
              iconClassName="bg-orange-50 text-orange-600"
              borderColor="border-l-orange-500"
            />
          )}

        {/* Total Users */}
        {stats &&
          stats.totalUsers !== undefined &&
          stats.totalUsers !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Users")}
              value={stats.totalUsers}
              icon={UsersIcon}
              iconClassName="bg-indigo-50 text-indigo-600"
              borderColor="border-l-indigo-500"
            />
          )}

        {/* Total Campaigns */}
        {stats &&
          stats.totalCampaigns !== undefined &&
          stats.totalCampaigns !== null && (
            <CardStat
              label={t("dashboard.dashboardStates.Total_Campaigns")}
              value={stats.totalCampaigns}
              icon={CampaignsIcon}
              iconClassName="bg-pink-50 text-pink-600"
              borderColor="border-l-pink-500"
            />
          )}
      </div>
    </div>
  );
}
