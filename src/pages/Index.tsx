import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import DraggableCard from "@/components/DraggableCard";
import { motion, useScroll, useTransform } from "framer-motion";
import { BookOpen, MessageCircle, FileText, Video, GraduationCap, ChevronLeft, ChevronRight, Dna, ScanEye, LayoutDashboard, Target, Music, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import BackgroundMusicPlayer from "@/components/BackgroundMusicPlayer";
import OnboardingWizard from "@/components/OnboardingWizard";
import SmartOnboarding, { useExpertiseLevel } from "@/components/SmartOnboarding";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHorses } from "@/hooks/useHorses";
import { useAppContent } from "@/hooks/useAppContent";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const DEFAULT_VIDEO = "https://cdn.pixabay.com/video/2020/07/30/45349-445579537_large.mp4";

const FEATURE_KEYS = [
  { icon: BookOpen, titleKey: "features.breedEncyclopedia", descKey: "features.breedEncyclopediaDesc", path: "/breeds" },
  { icon: GraduationCap, titleKey: "features.dmrt3Guide", descKey: "features.dmrt3GuideDesc", path: "/dmrt3" },
  { icon: MessageCircle, titleKey: "features.geneticsExpert", descKey: "features.geneticsExpertDesc", path: "/genetics-expert" },
  { icon: FileText, titleKey: "features.pedigreeAnalysis", descKey: "features.pedigreeAnalysisDesc", path: "/pedigree" },
  { icon: Music, titleKey: "features.metronome", descKey: "features.metronomeDesc", path: "/metronome" },
  { icon: Target, titleKey: "features.trainingPilot", descKey: "features.trainingPilotDesc", path: "/training-pilot" },
  { icon: Shield, titleKey: "features.gaitValidator", descKey: "features.gaitValidatorDesc", path: "/gait-validator" },
];

const Index = () => {
  const { t, lang, dir } = useLanguage();
  const { data: content } = useAppContent();
  const { horses, loading: horsesLoading } = useHorses();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [expertiseLevel, setExpertiseLevel] = useExpertiseLevel();
  const [videoUrls, setVideoUrls] = useState<string[]>([DEFAULT_VIDEO]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 50]);

  // Show onboarding for new users (no horses and haven't dismissed)
  useEffect(() => {
    if (!horsesLoading && horses.length === 0 && localStorage.getItem("onboarding-done") !== "true") {
      setShowOnboarding(true);
    }
  }, [horsesLoading, horses.length]);

  const quickActions = [
    { icon: Video, titleKey: "quick.gaitAnalysis", descKey: "quick.gaitAnalysisDesc", path: "/gait-analysis", accent: "bg-primary/15 text-primary" },
    { icon: LayoutDashboard, titleKey: "quick.dashboard", descKey: "quick.dashboardDesc", path: "/dashboard", accent: "bg-emerald-500/15 text-emerald-500" },
    { icon: ScanEye, titleKey: "quick.conformation", descKey: "quick.conformationDesc", path: "/conformation", accent: "bg-blue-500/15 text-blue-500" },
  ];

  useEffect(() => {
    const cached = sessionStorage.getItem("hero-video-urls");
    if (cached) {
      try {
        const urls = JSON.parse(cached) as string[];
        if (urls.length > 0) { setVideoUrls(urls); return; }
      } catch {}
    }
    const loadVideos = async () => {
      const { data } = await supabase.storage.from("hero-videos").list(undefined, { sortBy: { column: "name", order: "asc" } });
      if (data && data.length > 0) {
        const urls = data.filter((f) => !f.name.startsWith(".")).map((f) => supabase.storage.from("hero-videos").getPublicUrl(f.name).data.publicUrl);
        if (urls.length > 0) { setVideoUrls(urls); sessionStorage.setItem("hero-video-urls", JSON.stringify(urls)); }
      }
    };
    loadVideos();
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (videoUrls.length <= 1) {
      if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play(); }
      return;
    }
    setFadingOut(true);
    setTimeout(() => { setActiveIndex((prev) => (prev + 1) % videoUrls.length); setFadingOut(false); }, 600);
  }, [videoUrls.length]);

  useEffect(() => {
    if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => {}); }
  }, [activeIndex]);

  const ArrowIcon = dir === "rtl" ? ChevronLeft : ChevronRight;

  return (
    <div>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <SmartOnboarding onComplete={setExpertiseLevel} />
      {/* Hero */}
      <section ref={heroRef} className="relative overflow-hidden min-h-screen flex items-center py-20">
        <motion.div style={{ y: parallaxY }} className="absolute inset-0 -top-[10%] h-[120%]">
          <video
            ref={videoRef}
            key={videoUrls[activeIndex]}
            autoPlay muted playsInline preload="auto"
            onEnded={handleVideoEnded}
            className="w-full h-full object-cover object-center transition-opacity duration-500"
            style={{ opacity: fadingOut ? 0 : 1 }}
            poster="https://images.pexels.com/videos/4565585/free-video-4565585.jpg?auto=compress&cs=tinysrgb&w=1920"
          >
            <source src={videoUrls[activeIndex]} type="video/mp4" />
          </video>
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        <div className="container relative">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-rubik font-bold mb-6">
              <span className="text-gradient-gold">{t("app.name")}</span>
              <br />
              <span className="text-white/90 text-2xl md:text-4xl font-heebo font-light">
                {(lang === "he" ? content?.subtitle_he : content?.subtitle_en) || t("hero.subtitle")}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/75 mb-10 leading-relaxed max-w-2xl mx-auto">
              {(lang === "he" ? content?.description_he : content?.description_en) || t("hero.description")}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" className="text-base font-semibold min-h-[48px] px-8 shadow-lg shadow-primary/20">
                <Link to="/gait-analysis">
                  <Sparkles className={`h-4 w-4 ${dir === "rtl" ? "ml-2" : "mr-2"}`} />
                  {t("hero.startAnalysis")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base min-h-[48px] px-8 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                <Link to="/dashboard">
                  {t("hero.manageHorses")}
                  <ArrowIcon className={`h-4 w-4 ${dir === "rtl" ? "mr-1" : "ml-1"}`} />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-12 -mt-16 relative z-10">
        <div className="container max-w-4xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <motion.div
                key={action.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
              >
                <DraggableCard href={action.path}>
                  <div className="glass-card p-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <div className={`inline-flex p-3 rounded-xl ${action.accent} mb-3`}>
                      <action.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-rubik font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                      {t(action.titleKey)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(action.descKey)}</p>
                  </div>
                </DraggableCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>


      {/* About DMRT3 */}
      <section className="py-16 bg-card/50">
        <div className="container max-w-3xl text-center">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <Dna className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-rubik font-bold mb-4">{t("dmrt3.title")}</h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {t("dmrt3.description")}
            </p>
            <Button asChild variant="outline" className="min-h-[44px]">
              <Link to="/dmrt3">
                <Dna className={`h-4 w-4 ${dir === "rtl" ? "ml-2" : "mr-2"}`} />
                {t("dmrt3.fullGuide")}
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="py-20">
        <div className="container">
          <motion.div className="text-center mb-12" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <h2 className="text-3xl font-rubik font-bold mb-3">{t("features.title")}</h2>
            <p className="text-muted-foreground">{t("features.subtitle")}</p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {FEATURE_KEYS.map((feature) => (
              <motion.div key={feature.path} variants={itemVariants}>
                <Link to={feature.path} className="block group">
                  <div className="glass-card p-5 h-full transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                    <div className="inline-flex p-2.5 rounded-xl bg-primary/10 mb-3">
                      <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-rubik font-semibold mb-1.5 group-hover:text-primary transition-colors">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(feature.descKey)}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>
      <BackgroundMusicPlayer />
    </div>
  );
};

export default Index;
