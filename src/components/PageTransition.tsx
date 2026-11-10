import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const { dir } = useLanguage();
  const xOffset = dir === "rtl" ? -30 : 30;

  return (
    <motion.div
      initial={{ opacity: 0, x: xOffset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -xOffset }}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 200,
        opacity: { duration: 0.2 },
      }}
    >
      {children}
    </motion.div>
  );
}
