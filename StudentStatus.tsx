import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Clock, Users, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";

type QueueEntry = Database["public"]["Tables"]["queue_entries"]["Row"];
type Faculty = Database["public"]["Tables"]["faculty"]["Row"];

export default function StudentStatus() {
  const [, setLocation] = useLocation();
  const pathname = window.location.pathname;
  const queueId = pathname.split("/").pop() || "";

  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const loadQueueData = async () => {
    try {
      if (!queueId) throw new Error("Queue ID not provided");

      // Fetch queue entry
      const { data: queue, error: queueErr } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("id", queueId)
        .single();

      if (queueErr) throw queueErr;
      if (!queue) throw new Error("Queue entry not found");

      setQueueEntry(queue);

      // Fetch faculty info
      const { data: fac, error: facErr } = await supabase
        .from("faculty")
        .select("*")
        .eq("id", queue.faculty_id)
        .single();

      if (facErr) throw facErr;
      setFaculty(fac);

      // Calculate position in queue
      const { data: queueList, error: listErr } = await supabase
        .from("queue_entries")
        .select("*")
        .eq("faculty_id", queue.faculty_id)
        .in("status", ["waiting", "called"])
        .order("created_at", { ascending: true });

      if (listErr) throw listErr;

      const position = queueList?.findIndex((q) => q.id === queueId) ?? -1;
      setQueuePosition(position >= 0 ? position + 1 : null);

      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`queue:${queueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `id=eq.${queueId}`,
        },
        () => {
          loadQueueData();
        }
      )
      .subscribe();

    // Refresh every 10 seconds
    const interval = setInterval(loadQueueData, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [queueId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-100 text-yellow-800";
      case "called":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "waiting":
        return "Waiting in Queue";
      case "called":
        return "You're Being Called!";
      case "completed":
        return "Consultation Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !queueEntry || !faculty) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-md mx-auto mt-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || "Failed to load queue status"}</AlertDescription>
          </Alert>
          <Button onClick={() => setLocation("/")} className="mt-4 w-full">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  const estimatedWaitTime = queuePosition ? (queuePosition - 1) * 15 : 0;
  const isCalled = queueEntry.status === "called";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Queue Status</h1>
            <p className="text-slate-600 text-sm">Student: {queueEntry.student_number}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadQueueData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Status Alert */}
        {isCalled && (
          <Alert className="mb-6 bg-green-50 border-green-200">
            <AlertCircle className="h-5 w-5 text-green-600" />
            <AlertDescription className="text-green-800 font-semibold text-lg">
              🎉 You're being called! Proceed to the consultation area.
            </AlertDescription>
          </Alert>
        )}

        {/* Main Status Card */}
        <Card className="mb-6 border-2">
          <CardHeader className={`rounded-t-lg text-white ${isCalled ? "bg-gradient-to-r from-green-600 to-green-700" : "bg-gradient-to-r from-blue-600 to-blue-700"}`}>
            <CardTitle className="text-2xl">{getStatusLabel(queueEntry.status)}</CardTitle>
            <CardDescription className={isCalled ? "text-green-100" : "text-blue-100"}>
              {queueEntry.consultation_type === "face_to_face" ? "Face-to-Face Consultation" : "Google Meet Consultation"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Position */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center text-slate-600 mb-2">
                  <Users className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Position in Queue</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {queuePosition ? `#${queuePosition}` : "—"}
                </div>
              </div>

              {/* Wait Time */}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center text-slate-600 mb-2">
                  <Clock className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Est. Wait Time</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {estimatedWaitTime > 0 ? `${estimatedWaitTime} min` : "Next"}
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Faculty:</span>
                <span className="text-sm font-semibold text-slate-900">{faculty.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Email:</span>
                <span className="text-sm text-slate-900">{faculty.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Status:</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getStatusColor(queueEntry.status)}`}>
                  {getStatusLabel(queueEntry.status)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600">Booked:</span>
                <span className="text-sm text-slate-900">
                  {new Date(queueEntry.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Last Update */}
            <div className="mt-4 text-xs text-slate-500 text-center">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <p className="font-medium text-slate-900">Keep this page open</p>
                <p className="text-sm text-slate-600">Your position will update automatically</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <p className="font-medium text-slate-900">Wait for your turn</p>
                <p className="text-sm text-slate-600">You'll see a notification when you're called</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <p className="font-medium text-slate-900">Proceed to consultation</p>
                <p className="text-sm text-slate-600">
                  {queueEntry.consultation_type === "face_to_face"
                    ? "Go to the faculty office"
                    : "Join the Google Meet link"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
