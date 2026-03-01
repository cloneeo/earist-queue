import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, LogOut, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export default function StudentKiosk() {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const [studentNumber, setStudentNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateStudentNumber = (number: string): boolean => {
    // Matches the EARIST format: YYY-XXXXX (e.g., 222-03943M)
    const pattern = /^\d{3}-\d{5}[A-Z]?$/;
    return pattern.test(number);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!studentNumber.trim()) {
      setError("Please enter your student number");
      return;
    }

    if (!validateStudentNumber(studentNumber)) {
      setError("Invalid format. Use YYY-XXXXX (e.g., 222-03943M)");
      return;
    }

    setLoading(true);
    try {
      // 1. Register or update the student's active status in the database
      const { error: upsertError } = await supabase
        .from('students')
        .upsert({ 
          student_number: studentNumber, 
          last_active: new Date().toISOString() 
        }, { onConflict: 'student_number' });

      if (upsertError) throw upsertError;

      // 2. REDIRECT to the selection flow
      // This forces the student to pick a College, Department, and Faculty before getting a ticket
      setLocation(`/kiosk/booking?student=${encodeURIComponent(studentNumber)}`);

    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setLocation("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">EARIST Queue System</h1>
          <p className="text-slate-600">Student Consultation Queue</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Exit
        </Button>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-2xl">Enter Your Student Number</CardTitle>
            <CardDescription className="text-blue-100">
              Start your consultation queue booking
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="studentNumber" className="text-sm font-semibold text-slate-700">
                  Student Number
                </label>
                <Input
                  id="studentNumber"
                  type="text"
                  placeholder="e.g., 222-03943M"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="text-lg text-center font-mono h-14 border-slate-300 focus:ring-blue-500"
                  maxLength={11}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-8 text-xl rounded-xl shadow-lg transition-all active:scale-95"
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  "Continue to Selection"
                )}
              </Button>

              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 space-y-2 border border-slate-100">
                <p className="font-bold text-slate-700 uppercase tracking-wider">Instructions:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Enter your valid student number</li>
                  <li>Choose your professor and consultation type</li>
                  <li>Scan the resulting QR code at the Kiosk Monitor</li>
                </ul>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}