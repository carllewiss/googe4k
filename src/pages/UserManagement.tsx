import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Unlock, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  display_name: string;
  is_locked: boolean;
  failed_login_attempts: number;
  role: string | null;
  email: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "sales_agent">("sales_agent");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    // Fetch profiles and roles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, is_locked, failed_login_attempts");
    
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (profiles) {
      const userList: UserRow[] = profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          display_name: p.display_name,
          is_locked: p.is_locked,
          failed_login_attempts: p.failed_login_attempts,
          role: userRole?.role || null,
          email: p.display_name, // display_name is set to email on creation
        };
      });
      setUsers(userList);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("Fill all fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setCreating(true);

    // Use edge function to create user (admin-only operation)
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newEmail, password: newPassword, displayName: newName, role: newRole },
    });

    if (error) {
      toast.error("Failed to create user: " + error.message);
    } else if (data?.error) {
      toast.error(data.error);
    } else {
      toast.success(`User ${newName} created with role: ${newRole}`);
      setCreateOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      fetchUsers();
    }
    setCreating(false);
  };

  const unlockAccount = async (userId: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_locked: false, failed_login_attempts: 0, locked_at: null })
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to unlock account");
    } else {
      toast.success("Account unlocked");
      fetchUsers();
    }
  };

  const resetPassword = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { userId },
    });

    if (error || data?.error) {
      toast.error("Failed to reset password: " + (data?.error || error?.message));
    } else {
      toast.success(`Password reset to: ${data.temporaryPassword}. Share this with the user.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">User Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage user accounts</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Create User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Display Name</Label>
                <Input placeholder="John Doe" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" placeholder="john@4ksmart.co.ke" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="text" placeholder="Temporary password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={newRole} onValueChange={v => setNewRole(v as "admin" | "sales_agent")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="sales_agent">Sales Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={createUser} disabled={creating}>
                {creating ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Failed Attempts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium text-sm">{u.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {u.role?.replace("_", " ") || "No role"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.is_locked ? (
                      <Badge className="bg-destructive/10 text-destructive text-xs">Locked</Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success text-xs">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{u.failed_login_attempts}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {u.is_locked && (
                        <Button variant="outline" size="sm" onClick={() => unlockAccount(u.user_id)}>
                          <Unlock className="h-3 w-3 mr-1" /> Unlock
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => resetPassword(u.user_id)}>
                        <KeyRound className="h-3 w-3 mr-1" /> Reset Password
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
