import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { AlertCircle, LogOut, Loader2, Plus, Trash2, Edit2, Monitor, UserCheck, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import type { Database } from "@/lib/supabase";

type College = Database["public"]["Tables"]["colleges"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type Faculty = Database["public"]["Tables"]["faculty"]["Row"];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { signOut, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"colleges" | "departments" | "faculty">("colleges");

  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  const [selectedMonitorProf, setSelectedMonitorProf] = useState<string | null>(null);
  const [liveQueue, setLiveQueue] = useState<any[]>([]);
  
  // Modal States
  const [isCollegeModalOpen, setIsCollegeModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [isCollegeEditModalOpen, setIsCollegeEditModalOpen] = useState(false);
  const [isDeptEditModalOpen, setIsDeptEditModalOpen] = useState(false);

  // Edit Object States
  const [editingCollege, setEditingCollege] = useState<College | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newCollege, setNewCollege] = useState({ name: "", code: "" });
  const [newDept, setNewDept] = useState({ name: "", code: "", college_id: "" });
  const [newFaculty, setNewFaculty] = useState({ name: "", email: "", department_id: "" });

  useEffect(() => {
    if (userRole && userRole !== "admin") {
      setLocation("/");
    }
  }, [userRole, setLocation]);

  const loadData = async () => {
    try {
      const [collegesRes, departmentsRes, facultiesRes] = await Promise.all([
        supabase.from("colleges").select("*").order('name'),
        supabase.from("departments").select("*").order('name'),
        supabase.from("faculty").select("*").order('name'),
      ]);
      if (collegesRes.error) throw collegesRes.error;
      if (departmentsRes.error) throw departmentsRes.error;
      if (facultiesRes.error) throw facultiesRes.error;
      setColleges(collegesRes.data || []);
      setDepartments(departmentsRes.data || []);
      setFaculties(facultiesRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // --- REAL-TIME AUTO UPDATE LOGIC ---
  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('admin-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'colleges' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- DELETE LOGIC ---
  const handleDelete = async (table: string, id: string) => {
    const itemName = table === 'faculty' ? 'faculty member' : table.slice(0, -1);
    if (!confirm(`Are you sure you want to delete this ${itemName}?`)) return;
    
    try {
      const { error: err } = await supabase.from(table).delete().eq("id", id);
      if (err) throw err;
      toast.success("Deleted successfully");
      // UI will auto-refresh via the real-time channel subscription
    } catch (err: any) { 
      toast.error(err.message); 
    }
  };

  // --- UPDATE LOGIC ---
  const handleUpdateCollege = async () => {
    if (!editingCollege) return;
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.from("colleges").update({ name: editingCollege.name, code: editingCollege.code }).eq("id", editingCollege.id);
      if (err) throw err;
      setIsCollegeEditModalOpen(false);
      toast.success("College updated!");
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDept) return;
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.from("departments").update({ 
        name: editingDept.name, 
        code: editingDept.code, 
        college_id: editingDept.college_id 
      }).eq("id", editingDept.id);
      if (err) throw err;
      setIsDeptEditModalOpen(false);
      toast.success("Department updated!");
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  // --- ADD LOGIC ---
  const handleAddCollege = async () => {
    if (!newCollege.name || !newCollege.code) return toast.error("Fill in all fields.");
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.from("colleges").insert([newCollege]);
      if (err) throw err;
      setIsCollegeModalOpen(false);
      setNewCollege({ name: "", code: "" });
      toast.success("College added!");
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleAddDepartment = async () => {
    if (!newDept.name || !newDept.code || !newDept.college_id) return toast.error("Fill in all fields.");
    setIsSubmitting(true);
    try {
      const { error: err } = await supabase.from("departments").insert([newDept]);
      if (err) throw err;
      setIsDeptModalOpen(false);
      setNewDept({ name: "", code: "", college_id: "" });
      toast.success("Department added!");
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleAddFaculty = async () => {
    if (!newFaculty.name || !newFaculty.department_id || !newFaculty.email) return toast.error("Fill in all fields.");
    setIsSubmitting(true);
    setError(null);
    try {
      const tempPass = `${newFaculty.name.replace(/\s/g, '')}12345!`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newFaculty.email,
        password: tempPass,
      });
      
      if (authError) throw authError;

      const { error: profileError } = await supabase.from("faculty").insert([{
        user_id: authData.user?.id,
        name: newFaculty.name,
        email: newFaculty.email,
        department_id: newFaculty.department_id,
        status: "accepting",
        schedule: "TBA"
      }]);

      if (profileError) throw profileError;

      setIsFacultyModalOpen(false);
      setNewFaculty({ name: "", email: "", department_id: "" });
      alert(`Account Created!\nEmail: ${newFaculty.email}\nPassword: ${tempPass}`);
    } catch (err: any) {
      if (err.message.includes("already registered")) {
        setError("This email is already in use in Supabase Auth. Please delete it from the Auth > Users tab first.");
      } else {
        setError(err.message);
      }
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-auto p-8 border-r">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-bold">Admin Dashboard</h1></div>
          <Button variant="outline" onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Logout</Button>
        </div>

        {error && <Alert variant="destructive" className="mb-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="flex gap-2 mb-6">
          <Button variant={activeTab === "colleges" ? "default" : "outline"} onClick={() => setActiveTab("colleges")}>Colleges</Button>
          <Button variant={activeTab === "departments" ? "default" : "outline"} onClick={() => setActiveTab("departments")}>Departments</Button>
          <Button variant={activeTab === "faculty" ? "default" : "outline"} onClick={() => setActiveTab("faculty")}>Faculty</Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="capitalize">{activeTab}</CardTitle>
            <Button size="sm" onClick={() => {
              if (activeTab === "colleges") setIsCollegeModalOpen(true);
              else if (activeTab === "departments") setIsDeptModalOpen(true);
              else setIsFacultyModalOpen(true);
            }}><Plus className="mr-2 h-4 w-4" />Add New</Button>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className="text-left p-2">Name</th><th className="p-2 text-center">Actions</th></tr></thead>
              <tbody>
                {activeTab === "colleges" && colleges.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2 font-medium">{c.name} ({c.code})</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingCollege(c); setIsCollegeEditModalOpen(true); }}><Edit2 className="h-4 w-4 text-blue-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete("colleges", c.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activeTab === "departments" && departments.map(d => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2 font-medium">{d.name}</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingDept(d); setIsDeptEditModalOpen(true); }}><Edit2 className="h-4 w-4 text-blue-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete("departments", d.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activeTab === "faculty" && faculties.map(f => (
                  <tr key={f.id} className="border-b">
                    <td className="p-2 font-medium">{f.name}</td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete("faculty", f.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* EDIT MODALS (Fixed label errors) */}
      <Dialog open={isCollegeEditModalOpen} onOpenChange={setIsCollegeEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit College</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">College Name</label>
              <Input value={editingCollege?.name || ""} onChange={e => setEditingCollege(prev => prev ? {...prev, name: e.target.value} : null)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">College Code</label>
              <Input value={editingCollege?.code || ""} onChange={e => setEditingCollege(prev => prev ? {...prev, code: e.target.value} : null)} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateCollege} disabled={isSubmitting}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeptEditModalOpen} onOpenChange={setIsDeptEditModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Department Name</label>
              <Input value={editingDept?.name || ""} onChange={e => setEditingDept(prev => prev ? {...prev, name: e.target.value} : null)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Department Code</label>
              <Input value={editingDept?.code || ""} onChange={e => setEditingDept(prev => prev ? {...prev, code: e.target.value} : null)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">College</label>
              <Select value={editingDept?.college_id} onValueChange={val => setEditingDept(prev => prev ? {...prev, college_id: val} : null)}>
                <SelectTrigger><SelectValue placeholder="Select College" /></SelectTrigger>
                <SelectContent>{colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateDepartment} disabled={isSubmitting}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD MODALS */}
      <Dialog open={isCollegeModalOpen} onOpenChange={setIsCollegeModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New College</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">College Name</label>
              <Input placeholder="e.g. College of Engineering" value={newCollege.name} onChange={e => setNewCollege({...newCollege, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Code</label>
              <Input placeholder="e.g. CEN" value={newCollege.code} onChange={e => setNewCollege({...newCollege, code: e.target.value})} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddCollege} disabled={isSubmitting}>Add College</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeptModalOpen} onOpenChange={setIsDeptModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Department</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Dept Name</label>
              <Input placeholder="e.g. Computer Engineering" value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Code</label>
              <Input placeholder="e.g. CpE" value={newDept.code} onChange={e => setNewDept({...newDept, code: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">College</label>
              <Select onValueChange={val => setNewDept({...newDept, college_id: val})}>
                <SelectTrigger><SelectValue placeholder="Select College" /></SelectTrigger>
                <SelectContent>{colleges.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddDepartment} disabled={isSubmitting}>Add Department</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFacultyModalOpen} onOpenChange={setIsFacultyModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register New Faculty</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input placeholder="Juan Dela Cruz" value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="faculty@earist.edu.ph" value={newFaculty.email} onChange={e => setNewFaculty({...newFaculty, email: e.target.value})} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Department</label>
              <Select onValueChange={val => setNewFaculty({...newFaculty, department_id: val})}>
                <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddFaculty} disabled={isSubmitting}>Generate Account</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}