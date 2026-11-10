import { useState, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import {
  Dna, Microscope, Clock, Globe, Activity, TrendingUp,
  ArrowLeftRight, Calculator, Bone, PersonStanding, Scale,
  Brain, Grid3X3, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/contexts/LanguageContext";

// Lazy-load heavy components
const DMRT3Explainer = lazy(() => import("@/components/dmrt3/DMRT3Explainer"));
const ProteinDiagram = lazy(() => import("@/components/dmrt3/ProteinDiagram"));
const DiscoveryTimeline = lazy(() => import("@/components/dmrt3/DiscoveryTimeline"));
const DMRT3WorldMap = lazy(() => import("@/components/dmrt3/DMRT3WorldMap"));
const GaitBiomechanicsVisualizer = lazy(() => import("@/components/dmrt3/GaitBiomechanicsVisualizer"));
const GaitSpeedChart = lazy(() => import("@/components/dmrt3/GaitSpeedChart"));
const LateralVsDiagonalExplainer = lazy(() => import("@/components/dmrt3/LateralVsDiagonalExplainer"));
const InheritanceCalculator = lazy(() => import("@/components/dmrt3/InheritanceCalculator"));
const SpinalKinematicsVisualizer = lazy(() => import("@/components/dmrt3/SpinalKinematicsVisualizer"));
const SkeletalAnatomyExplainer = lazy(() => import("@/components/dmrt3/SkeletalAnatomyExplainer"));
const PostureComparisonTool = lazy(() => import("@/components/dmrt3/PostureComparisonTool"));
const DMRT3GenotypeDetails = lazy(() => import("@/components/dmrt3/DMRT3GenotypeDetails"));

interface CardItem {
  id: string;
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
}

const CARDS: CardItem[] = [
  { id: "explainer", titleKey: "dmrt3page.mutation", descKey: "dmrt3page.mutationDesc", icon: Dna },
  { id: "protein", titleKey: "dmrt3page.protein", descKey: "dmrt3page.proteinDesc", icon: Microscope },
  { id: "timeline", titleKey: "dmrt3page.timeline", descKey: "dmrt3page.timelineDesc", icon: Clock },
  { id: "worldmap", titleKey: "dmrt3page.worldmap", descKey: "dmrt3page.worldmapDesc", icon: Globe },
  { id: "biomech", titleKey: "dmrt3page.biomech", descKey: "dmrt3page.biomechDesc", icon: Activity },
  { id: "speed", titleKey: "dmrt3page.speed", descKey: "dmrt3page.speedDesc", icon: TrendingUp },
  { id: "lateral", titleKey: "dmrt3page.lateral", descKey: "dmrt3page.lateralDesc", icon: ArrowLeftRight },
  { id: "calculator", titleKey: "dmrt3page.calculator", descKey: "dmrt3page.calculatorDesc", icon: Calculator },
  { id: "spine", titleKey: "dmrt3page.spine", descKey: "dmrt3page.spineDesc", icon: Bone },
  { id: "skeleton", titleKey: "dmrt3page.skeleton", descKey: "dmrt3page.skeletonDesc", icon: PersonStanding },
  { id: "posture", titleKey: "dmrt3page.posture", descKey: "dmrt3page.postureDesc", icon: Scale },
  { id: "genotypes", titleKey: "dmrt3page.genotypes", descKey: "dmrt3page.genotypesDesc", icon: Brain },
  { id: "table", titleKey: "dmrt3page.table", descKey: "dmrt3page.tableDesc", icon: Grid3X3 },
];

function CardLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function InheritanceTable() {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-right py-3 px-4 font-semibold">{t("dmrt3page.inheritFather")}</th>
            <th className="text-center py-3 px-4 font-semibold">AA</th>
            <th className="text-center py-3 px-4 font-semibold">CA</th>
            <th className="text-center py-3 px-4 font-semibold">CC</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b border-border/50">
            <td className="py-3 px-4 font-semibold text-foreground">AA</td>
            <td className="text-center py-3 px-4">100% AA</td>
            <td className="text-center py-3 px-4">50% AA, 50% CA</td>
            <td className="text-center py-3 px-4">100% CA</td>
          </tr>
          <tr className="border-b border-border/50">
            <td className="py-3 px-4 font-semibold text-foreground">CA</td>
            <td className="text-center py-3 px-4">50% AA, 50% CA</td>
            <td className="text-center py-3 px-4">25% AA, 50% CA, 25% CC</td>
            <td className="text-center py-3 px-4">50% CA, 50% CC</td>
          </tr>
          <tr>
            <td className="py-3 px-4 font-semibold text-foreground">CC</td>
            <td className="text-center py-3 px-4">100% CA</td>
            <td className="text-center py-3 px-4">50% CA, 50% CC</td>
            <td className="text-center py-3 px-4">100% CC</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function renderCardContent(id: string) {
  switch (id) {
    case "explainer": return <DMRT3Explainer />;
    case "protein": return <ProteinDiagram />;
    case "timeline": return <DiscoveryTimeline />;
    case "worldmap": return <DMRT3WorldMap />;
    case "biomech": return <GaitBiomechanicsVisualizer />;
    case "speed": return <GaitSpeedChart />;
    case "lateral": return <LateralVsDiagonalExplainer />;
    case "calculator": return <InheritanceCalculator />;
    case "spine": return <SpinalKinematicsVisualizer />;
    case "skeleton": return <SkeletalAnatomyExplainer />;
    case "posture": return <PostureComparisonTool />;
    case "genotypes": return <DMRT3GenotypeDetails />;
    case "table": return <InheritanceTable />;
    default: return null;
  }
}

export default function DMRT3Guide() {
  const [openCard, setOpenCard] = useState<string | null>(null);
  const { t } = useLanguage();
  const activeCard = CARDS.find((c) => c.id === openCard);

  return (
    <div className="py-12">
      <div className="container max-w-5xl">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <Dna className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">
            {t("dmrt3page.title")}
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("dmrt3page.subtitle")}
          </p>
        </motion.div>

        {/* Card Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setOpenCard(card.id)}
                className="group flex flex-col items-center text-center gap-3 rounded-xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{t(card.titleKey)}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t(card.descKey)}</p>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Dialog */}
        <Dialog open={!!openCard} onOpenChange={(open) => !open && setOpenCard(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle className="flex items-center gap-2 text-lg font-rubik">
                {activeCard && <activeCard.icon className="h-5 w-5 text-primary" />}
                {activeCard ? t(activeCard.titleKey) : ""}
              </DialogTitle>
              <DialogDescription>{activeCard ? t(activeCard.descKey) : ""}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-120px)] px-6 pb-6">
              <Suspense fallback={<CardLoader />}>
                {openCard && renderCardContent(openCard)}
              </Suspense>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
