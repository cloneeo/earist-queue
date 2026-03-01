import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { QrCode, Users, BarChart3, LogOut, Monitor, UserCheck, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const { user, userRole, isAuthenticated, signOut } = useAuth();
  const [, setLocation] = useLocation();

  // Monitor States for Intro Page
  const [faculties, setFaculties] = useState<any[]>([]);
  const [selectedMonitorProf, setSelectedMonitorProf] = useState<string | null>(null);
  const [liveQueue, setLiveQueue] = useState<any[]>([]);

  // Load initial faculty list
  useEffect(() => {
    const loadFaculties = async () => {
      const { data } = await supabase.from("faculty").select("*").order('name');
      setFaculties(data || []);
    };
    loadFaculties();
  }, []);

  // Real-time listener for the monitor sidebar
  useEffect(() => {
    if (!selectedMonitorProf) return;

    const fetchQueue = async () => {
      const { data } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("faculty_id", selectedMonitorProf)
        .eq("status", "waiting")
        .order("created_at", { ascending: true });
      setLiveQueue(data || []);
    };

    fetchQueue();

    const channel = supabase.channel('home-monitor')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'queue_entries', filter: `faculty_id=eq.${selectedMonitorProf}` },
        () => fetchQueue()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedMonitorProf]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      
      {/* LEFT SIDE: MAIN NAVIGATION CARDS */}
      <div className="flex-1 overflow-auto">
        {/* Navigation Bar */}
        <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">EQ</span>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">EARIST Queue System</h1>
            </div>
            {isAuthenticated && (
              <div className="flex items-center gap-4">
                <span className="text-slate-300 text-xs hidden md:block">{user?.email}</span>
                <Button variant="outline" size="sm" onClick={handleLogout} className="border-slate-700 text-slate-300">
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </Button>
              </div>
            )}
          </div>
        </nav>

        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-6 py-16 text-center lg:text-left">
          <h2 className="text-5xl font-black text-white mb-4 leading-tight tracking-tighter">
            Queue Management System
          </h2>
          <p className="text-xl text-slate-400 mb-12 max-w-2xl">
            Streamlined consultation booking and real-time queue tracking for EARIST academic departments.
          </p>

          {/* Main Content Area */}
          {!isAuthenticated ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Student Kiosk Card */}
              <Card 
                className="border-slate-700 bg-slate-800/40 hover:bg-slate-700/40 transition-all cursor-pointer border-2 group"
                onClick={() => setLocation("/kiosk")}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <QrCode className="text-white w-6 h-6" />
                  </div>
                  <CardTitle className="text-white text-lg">Student Kiosk</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">Book and get your QR ticket.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold">Start Booking</Button>
                </CardContent>
              </Card>

              {/* Faculty Login Card */}
              <Card 
                className="border-slate-700 bg-slate-800/40 hover:bg-slate-700/40 transition-all cursor-pointer border-2 group"
                onClick={() => setLocation("/login")}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Users className="text-white w-6 h-6" />
                  </div>
                  <CardTitle className="text-white text-lg">Faculty Dashboard</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">Manage your queue profiles.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-green-600 hover:bg-green-700 font-bold">Faculty Login</Button>
                </CardContent>
              </Card>

              {/* Admin Panel Card */}
              <Card 
                className="border-slate-700 bg-slate-800/40 hover:bg-slate-700/40 transition-all cursor-pointer border-2 group"
                onClick={() => setLocation("/login")}
              >
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="text-white w-6 h-6" />
                  </div>
                  <CardTitle className="text-white text-lg">Admin Panel</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">System settings & controls.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 font-bold">Admin Login</Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader><CardTitle className="text-white">Quick Access</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={() => setLocation("/kiosk")} className="w-full justify-start text-slate-300" variant="outline"><QrCode className="mr-2 h-4 w-4" /> Student Kiosk</Button>
                  {(userRole === "faculty" || userRole === "admin") && (
                    <Button onClick={() => setLocation("/faculty")} className="w-full justify-start text-slate-300" variant="outline"><Users className="mr-2 h-4 w-4" /> Faculty Dashboard</Button>
                  )}
                  {userRole === "admin" && (
                    <Button onClick={() => setLocation("/admin")} className="w-full justify-start text-slate-300" variant="outline"><BarChart3 className="mr-2 h-4 w-4" /> Admin Panel</Button>
                  )}
                </CardContent>
              </Card>
              <Card className="border-slate-700 bg-slate-800/50">
                <CardHeader><CardTitle className="text-white">Account</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><p className="text-xs text-slate-500 font-bold uppercase">Email</p><p className="text-white">{user?.email}</p></div>
                  <div><p className="text-xs text-slate-500 font-bold uppercase">Role</p><Badge className="bg-blue-900/50 text-blue-400 capitalize border-blue-800">{userRole || "Student"}</Badge></div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-auto px-6 py-8 text-center text-slate-500 text-xs tracking-widest border-t border-slate-800">
          EARIST QUEUE MANAGEMENT SYSTEM © 2026
        </footer>
      </div>

      {/* RIGHT SIDE: LIVE MONITOR SIDEBAR */}
      <div className="w-[400px] bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl relative z-10">
        <div className="p-6 bg-blue-700 text-white flex items-center gap-3">
          <Monitor className="h-6 w-6" />
          <div>
            <h2 className="text-lg font-bold leading-none">Live Monitor</h2>
            <p className="text-blue-200 text-[10px] mt-1 uppercase tracking-widest">Real-time Kiosk Status</p>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-auto bg-slate-900/50 backdrop-blur-xl">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Faculty</label>
            <Select onValueChange={(val) => setSelectedMonitorProf(val)}>
              <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-slate-200 h-12 rounded-xl">
                <SelectValue placeholder="Pick a professor to watch" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-slate-800" />

          {selectedMonitorProf ? (
            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
              <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800/50 flex items-center justify-between shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                  <span className="font-bold text-slate-200 text-sm tracking-tight">Faculty Online</span>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400/20 text-[10px] bg-green-400/5">READY</Badge>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> Currently Waiting
                </h3>
                {liveQueue.length > 0 ? (
                  <div className="space-y-2">
                    {liveQueue.slice(0, 5).map((student, index) => (
                      <div key={student.id} 
                           className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${index === 0 ? 'bg-blue-600/10 border-blue-500/50 shadow-lg' : 'bg-slate-800 border-slate-700/50'}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs ${index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                          {index + 1}
                        </div>
                        <p className={`text-sm font-bold ${index === 0 ? 'text-white' : 'text-slate-300'}`}>
                          {student.student_number}
                        </p>
                        {index === 0 && <UserCheck className="ml-auto h-4 w-4 text-blue-400 animate-bounce" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600 text-xs font-bold uppercase tracking-widest bg-slate-800/10">
                    No students in line
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-blue-600/5 rounded-2xl border border-blue-500/10">
                <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Active Schedule</p>
                <p className="text-blue-400 font-black text-lg">
                  {faculties.find(f => f.id === selectedMonitorProf)?.schedule || "NOT POSTED"}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 opacity-10 text-white">
              <Monitor className="h-24 w-24 mb-6" />
              <p className="text-xs font-black uppercase tracking-[0.3em] text-center">Monitoring<br/>Inactive</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}