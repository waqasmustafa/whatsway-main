import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FaEllipsisH, FaEye, FaBan, FaSearch, FaCheck, FaPlus } from "react-icons/fa";
import { UserDialog } from "@/components/users/UserDialog";
import Header from "@/components/layout/header";
import { Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/contexts/auth-context";
import { isDemoUser, maskValue } from "@/utils/maskUtils";

interface UserType {
  id: string;
  username: string;
  email: string;
  status: string;
  avatar?: string;
  phone?: string;
  groups?: string[];
  lastLogin?: string;
}

interface PaginationType {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  banned: "bg-red-100 text-red-800",
};

const User: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [search, setSearch] = useState("");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const handleToggleStatus = async (user: UserType) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";

      const res = await apiRequest("PUT", `/api/user/status/${user.id}`, {
        status: newStatus,
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: t("users.toast.success"),
          description: `${t("users.toast.statusUpdated")} ${newStatus}`,
        });

        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
        );
      } else {
        toast({
          title: t("users.toast.error"),
          description: t("users.toast.statusUpdateFailed"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("users.toast.error"),
        description: t("users.toast.somethingWrong"),
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async (
    page = 1,
    searchTerm = "",
    limit = pagination.limit
  ) => {
    try {
      setLoading(true);

      const response = await apiRequest(
        "GET",
        `/api/admin/users?page=${page}&limit=${limit}&search=${searchTerm}`
      );

      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination);
      } else {
        toast({
          title: t("users.toast.error"),
          description: t("users.toast.fetchFailed"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("users.toast.error"),
        description: t("users.toast.fetchFailed"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(pagination.page, search, pagination.limit);
  }, [pagination.page, pagination.limit]);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: p }));
    }
  };

  const handleSearch = (e: any) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchUsers(1, search, pagination.limit);
  };

  const toggleUserSelection = (id: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dots-bg">
      <Header title={t("users.title")} subtitle={t("users.subtitle")} />

      <div className="p-4 md:p-6">
        {/* Search */}
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3 mb-6 w-full"
        >
          <div className="relative flex-1">
            <Input
              placeholder={t("users.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <Button className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
            {t("users.search.button")}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setPagination((prev) => ({ ...prev, page: 1 }));
              fetchUsers(1, "", pagination.limit);
            }}
            className="w-full sm:w-auto"
          >
            {t("users.search.clear")}
          </Button>

          {user?.role === "superadmin" && (
            <div className="flex-1 flex justify-end">
              <Button
                onClick={() => setIsUserDialogOpen(true)}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                <FaPlus className="mr-2" />
                {t("users.createUser")}
              </Button>
            </div>
          )}
        </form>

        {/* Stats */}
        <div className="mb-4 text-sm text-gray-700">
          {t("users.stats.showing")} {users.length} {t("users.stats.of")}{" "}
          {pagination.total} {t("users.stats.users")}
        </div>

        {/* TABLE FOR DESKTOP */}
        <div className="hidden md:block bg-white border rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {t("users.table.contact")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {t("users.table.phone")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {t("users.table.status")}
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {t("users.table.lastLogin")}
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold">
                  {t("users.table.actions")}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    {t("users.loading")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    {t("users.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(u.id)}
                        onChange={() => toggleUserSelection(u.id)}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-green-600 text-white flex items-center justify-center overflow-hidden">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            u.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <Link
                            href={`/users/${u.id}`}
                            className="text-sm font-medium hover:text-green-600"
                          >
                            {u.username}
                          </Link>
                          <p className="text-xs text-gray-500">{isDemoUser(user?.username) ? maskValue(u.email) : u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {u.phone || t("users.phonePlaceholder")}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold 
                        ${statusColors[u.status?.toLowerCase()]}`}
                      >
                        {u.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-sm">
                      {u.lastLogin
                        ? new Date(u.lastLogin).toLocaleDateString()
                        : t("users.lastLoginNever")}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-3 text-gray-500">
                        <Link href={`/users/${u.id}`}>
                          <FaEye className="cursor-pointer hover:text-green-600" />
                        </Link>
                        {u.status === "active" ? (
                          <FaBan
                            onClick={() => handleToggleStatus(u)}
                            className="cursor-pointer hover:text-red-600"
                            title={t("users.actions.blockUser")}
                          />
                        ) : (
                          <FaCheck
                            onClick={() => handleToggleStatus(u)}
                            className="cursor-pointer hover:text-green-600"
                            title={t("users.actions.activateUser")}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARD LIST */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <p className="text-center text-gray-500 py-10">
              {t("users.loading")}
            </p>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-10">
              {t("users.noUsers")}
            </p>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="bg-white shadow-sm rounded-lg p-4 border space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-600 text-white flex items-center justify-center overflow-hidden">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        u.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/users/${u.id}`}
                        className="font-semibold text-gray-800"
                      >
                        {u.username}
                      </Link>
                      <p className="text-xs text-gray-500">{isDemoUser(user?.username) ? maskValue(u.email) : u.email}</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={selectedUsers.has(u.id)}
                    onChange={() => toggleUserSelection(u.id)}
                  />
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <strong>{t("users.card.phone")}</strong>{" "}
                    {u.phone || t("users.phonePlaceholder")}
                  </p>
                  <p>
                    <strong>{t("users.card.status")}</strong>{" "}
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColors[u.status.toLowerCase()]
                        }`}
                    >
                      {u.status.toUpperCase()}
                    </span>
                  </p>
                  <p>
                    <strong>{t("users.card.lastLogin")}</strong>{" "}
                    {u.lastLogin
                      ? new Date(u.lastLogin).toLocaleDateString()
                      : t("users.lastLoginNever")}
                  </p>
                </div>

                <div className="flex justify-end gap-4 pt-2 text-gray-500">
                  <Link href={`/users/${u.id}`}>
                    <FaEye className="cursor-pointer hover:text-green-600" />
                  </Link>
                  {u.status === "active" ? (
                    <FaBan
                      onClick={() => handleToggleStatus(u)}
                      className="cursor-pointer hover:text-red-600"
                      title={t("users.actions.blockUser")}
                    />
                  ) : (
                    <FaCheck
                      onClick={() => handleToggleStatus(u)}
                      className="cursor-pointer hover:text-green-600"
                      title={t("users.actions.activateUser")}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <div className="flex items-center gap-4 order-2 sm:order-1">
            <span className="text-sm text-gray-700">
              {t("users.pagination.showing")}{" "}
              {(pagination.page - 1) * pagination.limit + 1}{" "}
              {t("users.pagination.to")}{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              {t("users.pagination.of")} {pagination.total}{" "}
              {t("users.pagination.users")}
            </span>

            <select
              value={pagination.limit}
              onChange={(e) =>
                setPagination((p) => ({
                  ...p,
                  limit: Number(e.target.value),
                  page: 1,
                }))
              }
              className="border px-2 py-1 rounded text-sm"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              {t("users.pagination.previous")}
            </Button>

            <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">
              {pagination.page}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              {t("users.pagination.next")}
            </Button>
          </div>
        </div>
      </div>

      <UserDialog
        open={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
        onSuccess={() => fetchUsers(pagination.page, search, pagination.limit)}
      />
    </div>
  );
};

export default User;
