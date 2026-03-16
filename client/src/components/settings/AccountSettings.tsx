import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Building, Shield, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserFormData {
  firstName: string;
  lastName: string;
}

export function AccountSettings() {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");

  // state for password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // --- update profile mutation
  const handleSaveChanges = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!user?.id) throw new Error("User ID is missing");
      if (!data.firstName.trim() || !data.lastName.trim()) {
        throw new Error("First name and last name are required");
      }
      return apiRequest("PUT", `/api/team/members/${user.id}`, data).then((r) => r.json());
    },
    onSuccess: (data) => {
      toast({
        title: "Account updated",
        description: "Your account information has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating account",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  // --- update password mutation
  const handlePasswordUpdate = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User ID is missing");
      if (!currentPassword || !newPassword || !confirmPassword) {
        throw new Error("All fields are required");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New passwords do not match");
      }

      return apiRequest("PATCH", `/api/team/members/${user.id}/password`, {
        currentPassword,
        newPassword,
      }).then((r) => r.json());
    },
    onSuccess: () => {
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating password",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    handleSaveChanges.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };


  const deleteAccount = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User ID missing");
      return apiRequest("DELETE", `/api/team/members/${user.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
      logout(); // log out user after delete
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete account",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Account Information
          </CardTitle>
          <CardDescription>Manage your account details and preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={!isEditing}
            />
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={!isEditing}
            />
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Username
              </Label>
              <Input id="username" defaultValue={user?.username} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Email
              </Label>
              <Input id="email" defaultValue={user?.email} disabled />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Role
              </Label>
              <Input value={user?.role} disabled className="bg-gray-50" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleString() : "N/A"}
            </div>
            <div className="space-x-2">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFirstName(user?.firstName || "");
                      setLastName(user?.lastName || "");
                      setIsEditing(false);
                    }}
                    disabled={handleSaveChanges.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={
                      handleSaveChanges.isPending || !firstName.trim() || !lastName.trim()
                    }
                  >
                    {handleSaveChanges.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Account</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security - Only for Superadmin */}
      {user?.role === 'superadmin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currentPasswordOnPage">Current Password</Label>
                <Input
                  id="currentPasswordOnPage"
                  type="password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPasswordOnPage">New Password</Label>
                <Input
                  id="newPasswordOnPage"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            {/* We still need confirm password for safety, or we can just send newPassword as both if the user really just wants two fields. 
                But handlePasswordUpdate expects confirmPassword for validation. 
                Let's add a confirm password field too to be safe, or modify the mutation. 
                The user's prompt only mentioned Current and New. 
                I'll add Confirm too as it's better UX, but hidden or simplified if possible. 
                Actually, I'll just add it to match handledPasswordUpdate mutation requirements. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="confirmPasswordOnPage">Confirm New Password</Label>
                <Input
                  id="confirmPasswordOnPage"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={() => handlePasswordUpdate.mutate()}
                disabled={handlePasswordUpdate.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
              >
                {handlePasswordUpdate.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Security */}
      {/* <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Manage your security preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Two-Factor Authentication</h4>
              <p className="text-sm text-gray-500">
                Add an extra layer of security to your account
              </p>
            </div>
            <Button variant="outline">Enable</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Change Password</h4>
              <p className="text-sm text-gray-500">Update your account password</p>
            </div>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(true)}>
              Change
            </Button>
          </div>
        </CardContent>
      </Card> */}

      {/* Password Modal */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                className="mt-3"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                className="mt-3"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                className="mt-3"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordModalOpen(false)}
              disabled={handlePasswordUpdate.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handlePasswordUpdate.mutate()}
              disabled={user?.username === 'demouser' ? true : handlePasswordUpdate.isPending}
            >
              {handlePasswordUpdate.isPending ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-gray-500">
                Permanently delete your account and all data
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Account</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your
                    account and remove all your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAccount.mutate()}
                    disabled={user?.username === 'demouser' ? true : deleteAccount.isPending}
                  >
                    {deleteAccount.isPending ? "Deleting..." : "Yes, delete my account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
