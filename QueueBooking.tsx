import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ChevronLeft, Loader2, MapPin, Video, School, BookOpen, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type College = Database["public"]["Tables"]["colleges"]["Row"];
type Department = Database["public"]["Tables"]["departments"]["Row"];
type Faculty = Database["public"]["Tables"]["faculty"]["Row"];

export default function QueueBooking() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const studentNumber = new URLSearchParams(search).get("student") || "";

  const [step, setStep] = useState<"college" | "department" | "faculty" | "type">("college");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [colleges, setColleges] = useState<College[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  const [selectedCollege, setSelectedCollege] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);

  // --- AUTO-UPDATE ENGINE LOGIC ---
  // We wrap the faculty loader in useCallback so it can be called by the real-time listener safely
  const loadFaculty = useCallback(async () => {
    if (!selectedDepartment) return;
    try {
      const { data, error: err } = await supabase
        .from("faculty")
        .select("*")
        .eq("department_id", selectedDepartment)
        .eq("status", "accepting");
      if (err) throw err;
      setFaculties(data || []);
    } catch (err) {
      setError("Failed to load faculty");
    }
  }, [selectedDepartment]);

  useEffect(() => {
    // This listener monitors the faculty table for status changes (e.g., going offline)
    const subscription = supabase
      .channel('faculty-updates')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'faculty' }, 
        () => {
          console.log("Change detected in faculty availability! Updating list...");
          loadFaculty(); // This refreshes your list automatically
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadFaculty]);

  // Load colleges on mount
  useEffect(() => {
    const loadColleges = async () => {
      try {
        const { data, error: err } = await supabase.from("colleges").select("*");
        if (err) throw err;
        setColleges(data || []);
      } catch (err) {
        setError("Failed to load colleges");
      }
    };
    loadColleges();
  }, []);

  // Load departments when college is selected
  useEffect(() => {
    if (!selectedCollege) return;
    const loadDepartments = async () => {
      try {
        const { data, error: err } = await supabase
          .from("departments")
          .select("*")
          .eq("college_id", selectedCollege);
        if (err) throw err;
        setDepartments(data || []);
      } catch (err) {
        setError("Failed to load departments");
      }
    };
    loadDepartments();
  }, [selectedCollege]);

  // Trigger faculty load when department is selected
  useEffect(() => {
    loadFaculty();
  }, [loadFaculty, selectedDepartment]);

  const handleCollegeSelect = (collegeId: string) => {
    setSelectedCollege(collegeId);
    setStep("department");
  };

  const handleDepartmentSelect = (deptId: string) => {
    setSelectedDepartment(deptId);
    setStep("faculty");
  };

  const handleFacultySelect = (facultyId: string) => {
    setSelectedFaculty(facultyId);
    setStep("type");
  };

  const handleTypeSelect = async (type: "face_to_face" | "google_meet") => {
    setLoading(true);
    setError(null);

    try {
      if (!selectedFaculty) throw new Error("Faculty not selected");

      const { data: queueEntry, error: err } = await supabase
        .from("queue_entries")
        .insert({
          faculty_id: selectedFaculty,
          student_number: studentNumber,
          consultation_type: type,
          status: "waiting",
        })
        .select()
        .single();

      if (err) throw err;
      
      setLocation(`/kiosk/confirmation?queueId=${queueEntry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book queue");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "department") { setStep("college"); setSelectedCollege(null); }
    if (step === "faculty") { setStep("department"); setSelectedDepartment(null); }
    if (step === "type") { setStep("faculty"); setSelectedFaculty(null); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Booking Portal</h1>
            <p className="text-slate-500 font-medium">Student: {studentNumber}</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm">
            <div className={`h-2 w-2 rounded-full ${loading ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-xs font-bold text-slate-600 uppercase">System Live</span>
          </div>
        </div>

        <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
          <CardHeader className="bg-blue-600 text-white p-8">
            <div className="flex items-center gap-3 mb-2">
              {step === "college" && <School className="w-5 h-5" />}
              {step === "department" && <BookOpen className="w-5 h-5" />}
              {step === "faculty" && <UserCircle className="w-5 h-5" />}
              <CardTitle className="uppercase tracking-widest text-sm font-black opacity-80">
                Step {step === "college" ? "1" : step === "department" ? "2" : step === "faculty" ? "3" : "4"} of 4
              </CardTitle>
            </div>
            <h2 className="text-3xl font-bold">
              {step === "college" && "Select Your College"}
              {step === "department" && "Select Your Department"}
              {step === "faculty" && "Choose Your Professor"}
              {step === "type" && "Meeting Method"}
            </h2>
          </CardHeader>

          <CardContent className="p-8">
            {error && (
              <Alert variant="destructive" className="mb-6 rounded-xl border-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-bold">{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {step === "college" && colleges.map((college) => (
                <Button key={college.id} variant="outline" className="h-auto p-6 justify-start text-left hover:border-blue-500 hover:bg-blue-50 border-2 rounded-2xl transition-all" onClick={() => handleCollegeSelect(college.id)}>
                  <div>
                    <div className="font-black text-slate-900 uppercase text-xs mb-1">{college.code}</div>
                    <div className="font-semibold text-slate-600">{college.name}</div>
                  </div>
                </Button>
              ))}

              {step === "department" && departments.map((dept) => (
                <Button key={dept.id} variant="outline" className="h-auto p-6 justify-start text-left hover:border-blue-500 hover:bg-blue-50 border-2 rounded-2xl transition-all" onClick={() => handleDepartmentSelect(dept.id)}>
                  <div>
                    <div className="font-black text-slate-900 uppercase text-xs mb-1">{dept.code}</div>
                    <div className="font-semibold text-slate-600">{dept.name}</div>
                  </div>
                </Button>
              ))}

              {step === "faculty" && (
                <div className="grid grid-cols-1 gap-3 md:col-span-2">
                  {faculties.length > 0 ? faculties.map((faculty) => (
                    <Button key={faculty.id} variant="outline" className="h-auto p-6 justify-start text-left hover:border-blue-500 hover:bg-blue-50 border-2 rounded-2xl transition-all" onClick={() => handleFacultySelect(faculty.id)}>
                      <div className="flex justify-between items-center w-full">
                        <div>
                          <div className="font-bold text-slate-900 text-lg">{faculty.name}</div>
                          <div className="text-sm text-slate-500 font-medium">{faculty.email}</div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-none uppercase text-[10px]">Available</Badge>
                      </div>
                    </Button>
                  )) : (
                    <div className="text-center py-10 text-slate-400 italic">No professors currently available for this department.</div>
                  )}
                </div>
              )}

              {step === "type" && (
                <>
                  <Button variant="outline" className="h-auto p-8 flex flex-col items-center gap-4 hover:border-blue-500 hover:bg-blue-50 border-2 rounded-3xl" onClick={() => handleTypeSelect("face_to_face")} disabled={loading}>
                    <MapPin className="w-10 h-10 text-blue-600" />
                    <div className="text-center">
                      <div className="font-black text-slate-900 uppercase">Face-to-Face</div>
                      <div className="text-xs text-slate-500">In-person at Faculty Room</div>
                    </div>
                  </Button>
                  <Button variant="outline" className="h-auto p-8 flex flex-col items-center gap-4 hover:border-blue-500 hover:bg-blue-50 border-2 rounded-3xl" onClick={() => handleTypeSelect("google_meet")} disabled={loading}>
                    <Video className="w-10 h-10 text-blue-600" />
                    <div className="text-center">
                      <div className="font-black text-slate-900 uppercase">Google Meet</div>
                      <div className="text-xs text-slate-500">Video call session</div>
                    </div>
                  </Button>
                </>
              )}
            </div>

            <div className="flex justify-between mt-10">
              {step !== "college" ? (
                <Button variant="ghost" className="text-slate-400 hover:text-slate-900" onClick={handleBack} disabled={loading}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              ) : <div />}
              <Button variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => setLocation("/kiosk")} disabled={loading}>
                Cancel Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}