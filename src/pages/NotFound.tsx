import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <span className="text-6xl mb-6 block" aria-hidden="true">🐴</span>
        <h1 className="text-6xl font-rubik font-bold text-gradient-gold mb-4">404</h1>
        <p className="text-xl text-foreground mb-2">הדף לא נמצא</p>
        <p className="text-muted-foreground mb-8">
          נראה שהסוס דהר לכיוון אחר... הדף שחיפשת לא קיים.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="min-h-[44px]">
            <Link to="/">
              <Home className="h-4 w-4 ml-2" />
              חזרה לדף הבית
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-[44px]">
            <Link to="/gait-analysis">
              ניתוח תנועה
              <ArrowRight className="h-4 w-4 mr-2" />
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
