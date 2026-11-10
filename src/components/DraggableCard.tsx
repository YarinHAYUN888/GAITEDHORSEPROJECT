import { motion, useMotionValue, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

interface DraggableCardProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
  onClick?: () => void;
}

export default function DraggableCard({ children, href, className = "", onClick }: DraggableCardProps) {
  const navigate = useNavigate();
  const { dir } = useLanguage();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-8, 0, 8]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 0.9, 1, 0.9, 0.5]);

  const handleDragEnd = (_: any, info: { velocity: { x: number }; offset: { x: number } }) => {
    const threshold = 120;
    const velocityThreshold = 400;
    const shouldNavigate =
      Math.abs(info.offset.x) > threshold || Math.abs(info.velocity.x) > velocityThreshold;

    if (shouldNavigate && href) {
      navigate(href);
    }
  };

  return (
    <motion.div
      drag="x"
      dragElastic={0.3}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      onClick={() => {
        if (href) navigate(href);
        onClick?.();
      }}
      style={{ x, rotate, opacity }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", damping: 20, stiffness: 250 }}
      className={`cursor-pointer touch-pan-y ${className}`}
    >
      {children}
    </motion.div>
  );
}
