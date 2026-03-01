import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, differenceInSeconds, addMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, subMonths, addMonths } from "date-fns";
import { AlertCircle, LogOut, Loader2, Calendar as CalendarIcon, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";

// FIXED: Defining types locally so you don't need the deleted folder
export interface QueueEntry {
  id: string; student_number: string; faculty_id: string;
  status: 'waiting' | 'called' | 'completed' | 'skipped';
  called_at?: string; created_at: string;
}

export interface FacultyProfile {
  id: string; user_id: string; name: string;
  status: 'accepting' | 'on_break' | 'offline';
  is_paused: boolean; department?: { name: string };
}

export interface FacultyAvailability {
  id: string; faculty_id: string; day_of_week: number;
  start_time: string; end_time: string;
}

export interface FacultyUnavailableDate {
  id: string; faculty_id: string; unavailable_date: string; reason?: string;
}

export default function FacultyDashboard() {
  const [, setLocation] = useLocation();
  const { user, signOut, userRole } = useAuth();
  
  const [faculty, setFaculty] = useState<FacultyProfile | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [availability, setAvailability] = useState<FacultyAvailability[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<FacultyUnavailableDate[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'queue' | 'availability'>('queue');
  
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (userRole && userRole !== "faculty" && userRole !== "admin") {
      setLocation("/");
    }
  }, [userRole, setLocation]);

  const loadData = async () => {
    try {
      if (!user) return;
      const { data: fac, error: facErr } = await supabase
        .from("faculty")
        .select("*, department:departments(*)")
        .eq("user_id", user.id)
        .single();

      if (facErr) throw facErr;
      setFaculty(fac as FacultyProfile);

      await Promise.all([
        fetchQueue(fac.id),
        fetchAvailability(fac.id)
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (user) {
      const subscription = supabase
        .channel("faculty-updates")
        .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries" }, () => {
          if (faculty?.id) fetchQueue(faculty.id);
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "faculty", filter: `user_id=eq.${user.id}` }, (payload) => {
           setFaculty((prev: FacultyProfile | null) => prev ? { ...prev, ...(payload.new as FacultyProfile) } : null);
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, [user, faculty?.id]);

  const fetchQueue = async (facultyId: string) => {
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("faculty_id", facultyId)
      .in("status", ["waiting", "called"])
      .order("created_at", { ascending: true });

    if (data) {
      setQueue(data as QueueEntry[]);
      const calling = data.find(q => q.status === 'called');
      if (calling && calling.called_at) {
        startTimer(calling.called_at, calling.id);
      } else {
        stopTimer();
      }
    }
  };

  const fetchAvailability = async (facultyId: string) => {
    const [avail, unavail] = await Promise.all([
      supabase.from('faculty_availability').select('*').eq('faculty_id', facultyId),
      supabase.from('faculty_unavailable_dates').select('*').eq('faculty_id', facultyId)
    ]);
    if (avail.data) setAvailability(avail.data as FacultyAvailability[]);
    if (unavail.data) setUnavailableDates(unavail.data as FacultyUnavailableDate[]);
  };

  const startTimer = (calledAt: string, queueId: string) => {
    stopTimer();
    const endTime = addMinutes(new Date(calledAt), 5);
    const updateTimer = () => {
      const diff = differenceInSeconds(endTime, new Date());
      if (diff <= 0) {
        handleNoShow(queueId);
        stopTimer();
      } else {
        setTimeLeft(diff);
      }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(null);
  };

  const handleStatusChange = async (status: "accepting" | "on_break" | "offline") => {
    if (!faculty) return;
    const { error: err } = await supabase.from("faculty").update({ status }).eq("id", faculty.id);
    if (!err) setFaculty({ ...faculty, status });
  };

  const handleCallNext = async () => {
    const nextStudent = queue.find(q => q.status === 'waiting');
    if (!nextStudent) return;
    await supabase.from("queue_entries").update({ status: "called", called_at: new Date().toISOString() }).eq("id", nextStudent.id);
  };

  const handleComplete = async (id: string) => {
    await supabase.from("queue_entries").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  };

  const handleNoShow = async (id: string) => {
    await supabase.from("queue_entries").update({ status: "skipped" }).eq("id", id);
    toast.error("Student marked as No-Show");
  };

  const handleUpdateAvailability = async (dayIndex: number, start: string, end: string) => {
    if (!faculty) return;
    await supabase.from('faculty_availability').upsert({ 
      faculty_id: faculty.id, day_of_week: dayIndex, start_time: start, end_time: end 
    }, { onConflict: 'faculty_id,day_of_week' });
    fetchAvailability(faculty.id);
  };

  const handleToggleUnavailableDate = async (date: Date) => {
    if (!faculty) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = unavailableDates.find((ud) => ud.unavailable_date === dateStr);
    if (existing) {
      await supabase.from('faculty_unavailable_dates').delete().eq('id', existing.id);
    } else {
      const reason = window.prompt("Reason for absence?", "Personal Leave");
      await supabase.from('faculty_unavailable_dates').insert({ 
        faculty_id: faculty.id, 
        unavailable_date: dateStr,
        reason: reason || "Unavailable"
      });
    }
    fetchAvailability(faculty.id);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a]"><Loader2 className="animate-spin text-blue-500 w-12 h-12" /></div>;

  const currentCalling = queue.find(q => q.status === 'called');
  const pending = queue.filter(q => q.status === 'waiting');
  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight uppercase">Faculty Portal</h1>
            <p className="text-slate-500 font-medium">{faculty?.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveView(activeView === 'queue' ? 'availability' : 'queue')}>
              {activeView === 'queue' ? <CalendarIcon className="w-4 h-4 mr-2" /> : <Users className="w-4 h-4 mr-2" />}
              {activeView === 'queue' ? 'Availability' : 'Queue'}
            </Button>
            <Button variant="ghost" onClick={() => signOut()} className="text-red-600 hover:bg-red-50">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </header>

        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <AnimatePresence mode="wait">
          {activeView === 'queue' ? (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-sm font-bold uppercase text-slate-500">Service Status</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Button variant={faculty?.status === 'accepting' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('accepting')}>Accepting</Button>
                      <Button variant={faculty?.status === 'on_break' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('on_break')}>On Break</Button>
                      <Button variant={faculty?.status === 'offline' ? 'default' : 'outline'} size="sm" onClick={() => handleStatusChange('offline')}>Offline</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-blue-600 text-white shadow-xl overflow-hidden">
                  <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                      <CardTitle className="text-white/80 text-xs uppercase">Currently Serving</CardTitle>
                      {currentCalling && <h2 className="text-4xl font-black mt-2">{currentCalling.student_number}</h2>}
                    </div>
                    {timeLeft !== null && (
                      <div className="bg-white/20 px-3 py-1 rounded font-mono text-xs border border-white/30">
                        GRACE PERIOD: {formatTime(timeLeft)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {!currentCalling ? (
                      <div className="text-center py-6">
                        <Button variant="secondary" onClick={handleCallNext} disabled={pending.length === 0}>Call Next Student</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-4">
                        <Button variant="secondary" className="w-full" onClick={() => handleComplete(currentCalling.id)}>Complete</Button>
                        <Button variant="destructive" className="w-full" onClick={() => handleNoShow(currentCalling.id)}>No-Show</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-lg">Waiting List ({pending.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {pending.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-slate-300">0{i + 1}</span>
                          <span className="font-bold">{s.student_number}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ) : (
            <motion.div key="availability" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader><CardTitle>Weekly Working Hours</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                    const daySched = availability.find((a: any) => a.day_of_week === index);
                    return (
                      <div key={day} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                        <span className="font-medium text-sm">{day}</span>
                        <div className="flex items-center gap-2">
                          <input type="time" defaultValue={daySched?.start_time?.slice(0, 5) || "08:00"} className="border p-1 text-xs rounded" onBlur={(e) => handleUpdateAvailability(index, e.target.value, daySched?.end_time || "17:00")} />
                          <span className="text-slate-400">-</span>
                          <input type="time" defaultValue={daySched?.end_time?.slice(0, 5) || "17:00"} className="border p-1 text-xs rounded" onBlur={(e) => handleUpdateAvailability(index, daySched?.start_time || "08:00", e.target.value)} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                  <CardTitle>Unavailable Dates</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16}/></Button>
                    <span className="text-sm font-bold">{format(currentMonth, 'MMMM yyyy')}</span>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16}/></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isUnavail = unavailableDates.some((ud) => ud.unavailable_date === dateStr);
                      return (
                        <button
                          key={i}
                          onClick={() => handleToggleUnavailableDate(day)}
                          className={`aspect-square text-xs rounded-md border ${isUnavail ? 'bg-red-500 text-white' : 'bg-white'}`}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}