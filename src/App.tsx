import { lazy, Suspense, forwardRef, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Layout from "@/components/Layout";
import PageTransition from "@/components/PageTransition";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import { initGA, trackPageView } from "@/lib/analytics";

// Eagerly loaded (critical path)
import Index from "./pages/Index";

// Lazy loaded pages
const BreedEncyclopedia = lazy(() => import("./pages/BreedEncyclopedia"));
const BreedDetail = lazy(() => import("./pages/BreedDetail"));
const DMRT3Guide = lazy(() => import("./pages/DMRT3Guide"));
const GeneticsExpert = lazy(() => import("./pages/GeneticsExpert"));
const PedigreeAnalysis = lazy(() => import("./pages/PedigreeAnalysis"));
const GaitAnalysis = lazy(() => import("./pages/GaitAnalysis"));
const ConformationAnalysis = lazy(() => import("./pages/ConformationAnalysis"));
const StableDashboard = lazy(() => import("./pages/StableDashboard"));
const GaitMetronome = lazy(() => import("./pages/GaitMetronome"));
const PredictiveTraining = lazy(() => import("./pages/PredictiveTraining"));
const GaitValidator = lazy(() => import("./pages/GaitValidator"));
const HorseProfile = lazy(() => import("./pages/HorseProfile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SharedAnalysis = lazy(() => import("./pages/SharedAnalysis"));
const TrainingCalendar = lazy(() => import("./pages/TrainingCalendar"));
const MultiHorseComparison = lazy(() => import("./pages/MultiHorseComparison"));
const Methodology = lazy(() => import("./pages/Methodology"));
const Auth = lazy(() => import("./pages/Auth"));
const OwnerFlowMockup = lazy(() => import("./pages/OwnerFlowMockup"));
const Admin = lazy(() => import("./pages/Admin"));
import ProtectedRoute from "@/components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const LazyPage = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, _ref) => (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  )
);
LazyPage.displayName = "LazyPage";

const ProtectedPage = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, _ref) => (
    <ErrorBoundary>
      <ProtectedRoute>
        <Layout>{children}</Layout>
      </ProtectedRoute>
    </ErrorBoundary>
  )
);
ProtectedPage.displayName = "ProtectedPage";

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={location.pathname}>
        <Routes location={location}>
          <Route path="/auth" element={<LazyPage><Auth /></LazyPage>} />
          <Route path="/mockup/owner-flow" element={<LazyPage><OwnerFlowMockup /></LazyPage>} />
          <Route path="/" element={<ProtectedPage><Index /></ProtectedPage>} />
          <Route path="/breeds" element={<ProtectedPage><LazyPage><BreedEncyclopedia /></LazyPage></ProtectedPage>} />
          <Route path="/breeds/:id" element={<ProtectedPage><LazyPage><BreedDetail /></LazyPage></ProtectedPage>} />
          <Route path="/dmrt3" element={<ProtectedPage><LazyPage><DMRT3Guide /></LazyPage></ProtectedPage>} />
          <Route path="/calculator" element={<ProtectedPage><LazyPage><NotFound /></LazyPage></ProtectedPage>} />
          <Route path="/genetics-expert" element={<ProtectedPage><LazyPage><GeneticsExpert /></LazyPage></ProtectedPage>} />
          <Route path="/pedigree" element={<ProtectedPage><LazyPage><PedigreeAnalysis /></LazyPage></ProtectedPage>} />
          <Route path="/gait-analysis" element={<ProtectedPage><LazyPage><GaitAnalysis /></LazyPage></ProtectedPage>} />
          <Route path="/conformation" element={<ProtectedPage><LazyPage><ConformationAnalysis /></LazyPage></ProtectedPage>} />
          <Route path="/dashboard" element={<ProtectedPage><LazyPage><StableDashboard /></LazyPage></ProtectedPage>} />
          <Route path="/admin" element={<ProtectedPage><LazyPage><Admin /></LazyPage></ProtectedPage>} />
          <Route path="/metronome" element={<ProtectedPage><LazyPage><GaitMetronome /></LazyPage></ProtectedPage>} />
          <Route path="/training-pilot" element={<ProtectedPage><LazyPage><PredictiveTraining /></LazyPage></ProtectedPage>} />
          <Route path="/gait-validator" element={<ProtectedPage><LazyPage><GaitValidator /></LazyPage></ProtectedPage>} />
          <Route path="/horse/:id" element={<ProtectedPage><LazyPage><HorseProfile /></LazyPage></ProtectedPage>} />
          <Route path="/training-calendar" element={<ProtectedPage><LazyPage><TrainingCalendar /></LazyPage></ProtectedPage>} />
          <Route path="/multi-compare" element={<ProtectedPage><LazyPage><MultiHorseComparison /></LazyPage></ProtectedPage>} />
          <Route path="/methodology" element={<ProtectedPage><LazyPage><Methodology /></LazyPage></ProtectedPage>} />
          <Route path="/share/:token" element={<LazyPage><SharedAnalysis /></LazyPage>} />
          <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

const App = () => {
  useEffect(() => { initGA(); }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AnimatedRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
