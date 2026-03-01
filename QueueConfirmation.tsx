import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Download, Home, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import type { Database } from "@/lib/supabase";

type QueueEntry = Database["public"]["Tables"]["queue_entries"]["Row"];
type Faculty = Database["public"]["Tables"]["faculty"]["Row"];

export default function QueueConfirmation() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queueId = new URLSearchParams(search).get("queueId") || "";

  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [faculty, setFaculty] = useState<Faculty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        // Add history entry
        await supabase.from("queue_history").insert({
          queue_entry_id: queueId,
          action: "booked",
          notes: `Student ${queue.student_number} booked for ${queue.consultation_type}`,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load queue data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadQueueData();
  }, [queueId]);

  const handleDownloadQR = () => {
    const qrElement = document.getElementById("qr-code");
    if (qrElement) {
      const canvas = qrElement.querySelector("canvas");
      if (canvas) {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `ticket-${queueEntry?.student_number}.png`;
        link.click();
      }
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
            <AlertDescription>{error || "Failed to load queue confirmation"}</AlertDescription>
          </Alert>
          <Button onClick={() => setLocation("/kiosk")} className="mt-4 w-full">
            Return to Kiosk
          </Button>
        </div>
      </div>
    );
  }

  const statusPageUrl = `${window.location.origin}/status/${queueId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md mx-auto">
        <Card className="border-2 border-green-500">
          <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
            <CardTitle className="text-2xl">✓ Consultation Confirmed!</CardTitle>
            <CardDescription className="text-green-100">Your queue entry has been created</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* QR Code */}
            <div className="flex flex-col items-center space-y-3">
              <div id="qr-code" className="bg-white p-4 rounded-lg border-2 border-slate-200">
                <QRCodeSVG
                  value={statusPageUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">Scan to track your position</p>
            </div>

            {/* Details */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">Student Number:</span>
                <span className="text-sm font-semibold text-slate-900">{queueEntry.student_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">Faculty:</span>
                <span className="text-sm font-semibold text-slate-900">{faculty.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">Type:</span>
                <span className="text-sm font-semibold text-slate-900">
                  {queueEntry.consultation_type === "face_to_face" ? "Face-to-Face" : "Google Meet"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-600">Queue ID:</span>
                <span className="text-xs font-mono text-slate-900">{queueId.slice(0, 8)}...</span>
              </div>
            </div>

            {/* Instructions */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Next Steps:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Save or screenshot your QR code</li>
                  <li>Visit the status page to track your position</li>
                  <li>Wait for your turn to be called</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="space-y-2">
              <Button onClick={handleDownloadQR} className="w-full bg-blue-600 hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                Download QR Code
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation(`/status/${queueId}`)}
                className="w-full"
              >
                View Status Page
              </Button>
              <Button
                variant="ghost"
                onClick={() => setLocation("/kiosk")}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Kiosk
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
