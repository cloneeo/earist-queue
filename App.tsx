import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import StudentKiosk from "./pages/StudentKiosk";
import QueueBooking from "./pages/QueueBooking";
import QueueConfirmation from "./pages/QueueConfirmation";
import StudentStatus from "./pages/StudentStatus";
import FacultyDashboard from "./pages/FacultyDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import { Loader2 } from "lucide-react";

// Helper component for role-based access
const ProtectedRoute = ({ 
  component: Component, 
  allowedRoles 
}: { 
  component: React.ComponentType<any>, 
  allowedRoles: ("admin" | "faculty" | "student")[] 
}) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (userRole && !allowedRoles.includes(userRole)) {
    // Redirect to their appropriate dashboard if they try to access a forbidden area
    if (userRole === "admin") return <Redirect to="/admin" />;
    if (userRole === "faculty") return <Redirect to="/faculty" />;
    return <Redirect to="/kiosk" />;
  }

  return <Component />;
};

function Router() {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading EARIST Queue System...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/login">
        {user ? (
          // Auto-redirect logged-in users away from the login page
          userRole === "admin" ? <Redirect to="/admin" /> :
          userRole === "faculty" ? <Redirect to="/faculty" /> : 
          <Redirect to="/kiosk" />
        ) : (
          <Login />
        )}
      </Route>

      {/* Student Kiosk Routes (Accessible by Students and Admins) */}
      <Route path="/kiosk">
        <ProtectedRoute component={StudentKiosk} allowedRoles={["student", "admin"]} />
      </Route>
      <Route path="/kiosk/booking">
        <ProtectedRoute component={QueueBooking} allowedRoles={["student", "admin"]} />
      </Route>
      <Route path="/kiosk/confirmation">
        <ProtectedRoute component={QueueConfirmation} allowedRoles={["student", "admin"]} />
      </Route>
      <Route path="/status/:queueId" component={StudentStatus} />

      {/* Faculty Routes - Accessible by Faculty and Admin */}
      <Route path="/faculty">
        <ProtectedRoute component={FacultyDashboard} allowedRoles={["faculty", "admin"]} />
      </Route>

      {/* Admin Routes Only */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster position="top-center" richColors />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;