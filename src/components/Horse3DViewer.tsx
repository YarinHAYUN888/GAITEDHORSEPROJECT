// Horse3DViewer — Main component (refactored to use sub-components)
import { Component, type ReactNode } from "react";
import { useRef, useState, useEffect, useMemo, useCallback, Suspense, memo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { Play, Pause, Flame, Box, ArrowUpDown, Footprints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { SuspensionData } from "@/types/gait";
import { LEG_COLORS, getPhaseOffsetsForGait, getGaitMeta, getStanceDuty } from "@/lib/gaitCalculations";
import ForceDistributionOverlay from "@/components/biomech/ForceDistributionOverlay";
import HoofDust from "@/components/viewer3d/HoofDust";

// Sub-components
import HorseModel from "@/components/viewer3d/HorseModel";
import BiomechanicalSkeleton from "@/components/viewer3d/BiomechanicalSkeleton";
import BeatPhaseHUD from "@/components/viewer3d/BeatPhaseHUD";
import { DEFAULT_BBOX, LEG_KEYS, CAMERA_PRESETS } from "@/components/viewer3d/constants";

interface Props {
  keypoints?: any;
  jointAngles?: Record<string, Record<string, number>>;
  symmetryScore?: number;
  suspensionData?: SuspensionData;
  gaitType?: string;
}

/* ─── Scene ─── */
function Scene({ isPlaying, speed, jointAngles, showHeatmap, showSkeleton, showForces, showTopline, gaitType, cameraPreset }: {
  isPlaying: boolean; speed: number; jointAngles?: Record<string, Record<string, number>>;
  showHeatmap: boolean; showSkeleton: boolean; showForces: boolean; showTopline: boolean;
  gaitType?: string; cameraPreset: number;
}) {
  const phaseRef = useRef(0);
  const poseRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const controlsRef = useRef<any>(null);
  const [bbox, setBBox] = useState<THREE.Box3>(DEFAULT_BBOX);

  const offsets = useMemo(() => getPhaseOffsetsForGait(gaitType), [gaitType]);
  const stanceDuty = useMemo(() => getStanceDuty(gaitType), [gaitType]);

  useEffect(() => {
    if (controlsRef.current) {
      const pos = CAMERA_PRESETS[cameraPreset].position;
      controlsRef.current.object.position.set(...pos);
      controlsRef.current.update();
    }
  }, [cameraPreset]);

  const handleBBox = useCallback((b: THREE.Box3) => setBBox(b), []);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0001}>
        <orthographicCamera attach="shadow-camera" args={[-2, 2, 2, -2, 0.1, 20]} />
      </directionalLight>
      <directionalLight position={[-3, 4, -2]} intensity={0.3} color="#b0c4de" />
      <directionalLight position={[0, 2, -4]} intensity={0.2} color="#ffd4a0" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <shadowMaterial transparent opacity={0.4} />
      </mesh>
      <gridHelper args={[4, 20, "#333355", "#222244"]} position={[0, 0, 0]} />

      <HorseModel isPlaying={isPlaying} speed={speed} phaseRef={phaseRef} onBBoxReady={handleBBox} gaitType={gaitType} />
      <BiomechanicalSkeleton
        jointAngles={jointAngles} showHeatmap={showHeatmap} showSkeleton={showSkeleton}
        showTopline={showTopline} showTrails={showSkeleton} phaseRef={phaseRef} poseRef={poseRef} gaitType={gaitType} bbox={bbox}
      />
      {showForces && LEG_KEYS.map((legKey) => (
        <ForceDistributionOverlay
          key={legKey}
          legKey={legKey}
          phaseRef={phaseRef}
          poseRef={poseRef}
          offsets={offsets}
          stanceDuty={stanceDuty}
        />
      ))}
      <HoofDust phaseRef={phaseRef} gaitType={gaitType} bbox={bbox} />
      <BeatPhaseHUD phaseRef={phaseRef} gaitType={gaitType} />
      <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate minDistance={0.5} maxDistance={5} target={[0, 0.4, 0]} />
    </>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#666" wireframe />
    </mesh>
  );
}

function CanvasErrorFallback() {
  return (
    <div className="bg-muted/30 rounded-xl flex items-center justify-center" style={{ height: "400px" }}>
      <div className="text-center space-y-2 p-6">
        <Box className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">לא ניתן לטעון את המודל התלת-ממדי</p>
        <p className="text-xs text-muted-foreground/60">נסה לעבור לתצוגת 2D</p>
      </div>
    </div>
  );
}

/* ─── Error Boundary for 3D Canvas ─── */
class Canvas3DWrapper extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.warn("3D viewer error:", error); }
  render() {
    if (this.state.hasError) return <CanvasErrorFallback />;
    return this.props.children;
  }
}

/* ─── Main Component ─── */
const GAIT_OPTIONS = [
  { value: "tolt", label: "Tölt", labelHe: "טולט" },
  { value: "trot", label: "Trot", labelHe: "טרוט" },
  { value: "walk", label: "Walk", labelHe: "צעד" },
  { value: "pace", label: "Pace", labelHe: "פייס" },
  { value: "rack", label: "Rack", labelHe: "ראק" },
  { value: "running_walk", label: "Running Walk", labelHe: "ר. ווק" },
] as const;

export default memo(function Horse3DViewer({ jointAngles: rawJointAngles, symmetryScore, suspensionData, gaitType: initialGaitType }: Props) {
  const jointAngles = rawJointAngles && typeof rawJointAngles === "object" ? rawJointAngles : undefined;
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showForces, setShowForces] = useState(false);
  const [showTopline, setShowTopline] = useState(true);
  const [cameraPreset, setCameraPreset] = useState(3);
  const [selectedGait, setSelectedGait] = useState(initialGaitType ?? "tolt");

  const gaitType = selectedGait;
  const meta = useMemo(() => getGaitMeta(gaitType), [gaitType]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Box className="h-4 w-4 text-primary" />
          ויזואליזציה ביומכנית 3D
          {meta && <span className="text-xs font-normal text-muted-foreground">({meta.nameHe})</span>}
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Switch id="heatmap-3d" checked={showHeatmap} onCheckedChange={setShowHeatmap} className="data-[state=checked]:bg-orange-500" />
            <Label htmlFor="heatmap-3d" className="text-xs text-muted-foreground cursor-pointer"><Flame className="h-3 w-3 inline ml-1" />מפת חום</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="skeleton-3d" checked={showSkeleton} onCheckedChange={setShowSkeleton} />
            <Label htmlFor="skeleton-3d" className="text-xs text-muted-foreground cursor-pointer">שלד</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="topline-3d" checked={showTopline} onCheckedChange={setShowTopline} className="data-[state=checked]:bg-sky-500" />
            <Label htmlFor="topline-3d" className="text-xs text-muted-foreground cursor-pointer">עמ״ש</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="forces-3d" checked={showForces} onCheckedChange={setShowForces} className="data-[state=checked]:bg-green-500" />
            <Label htmlFor="forces-3d" className="text-xs text-muted-foreground cursor-pointer"><ArrowUpDown className="h-3 w-3 inline ml-1" />כוחות</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">×{speed.toFixed(speed < 1 ? 2 : 1)}</span>
            <Slider value={[speed]} onValueChange={([v]) => setSpeed(v)} min={0.25} max={3} step={0.25} className="w-20" />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPlaying(p => !p)} aria-label={isPlaying ? "עצור אנימציה" : "הפעל אנימציה"}>
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Gait type selector */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <Footprints className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground ml-1">סוג צעד:</span>
        {GAIT_OPTIONS.map((g) => (
          <Button
            key={g.value}
            variant={selectedGait === g.value ? "default" : "outline"}
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => setSelectedGait(g.value)}
          >
            {g.labelHe}
          </Button>
        ))}
      </div>

      <div className="flex gap-1.5 justify-end">
        {CAMERA_PRESETS.map((preset, i) => (
          <Button key={preset.label} variant={cameraPreset === i ? "default" : "outline"} size="sm" className="h-6 px-2 text-[10px]" onClick={() => setCameraPreset(i)}>
            {preset.icon} {preset.label}
          </Button>
        ))}
      </div>

      <Canvas3DWrapper>
        <div className="bg-muted/30 rounded-xl overflow-hidden" style={{ height: "400px" }} role="img" aria-label="ויזואליזציה ביומכנית תלת-ממדית של תנועת הסוס">
          <Canvas dpr={[1, 1.5]} camera={{ position: [1.5, 1, 1.5], fov: 45 }} shadows>
            <Suspense fallback={<LoadingFallback />}>
              <Scene
                isPlaying={isPlaying} speed={speed} jointAngles={jointAngles}
                showHeatmap={showHeatmap} showSkeleton={showSkeleton} showForces={showForces}
                showTopline={showTopline} gaitType={gaitType} cameraPreset={cameraPreset}
              />
            </Suspense>
          </Canvas>
        </div>
      </Canvas3DWrapper>

      <div className="flex flex-wrap gap-3 justify-center text-xs text-muted-foreground">
        {Object.entries(LEG_COLORS || {}).map(([leg, color]) => (
          <div key={leg} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span>{leg === "frontLeft" ? "קדמית שמאל" : leg === "frontRight" ? "קדמית ימין" : leg === "hindLeft" ? "אחורית שמאל" : "אחורית ימין"}</span>
          </div>
        ))}
        {showTopline && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500" /><span>ראש</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-slate-400" /><span>עמוד שדרה</span></div>
          </>
        )}
        {showHeatmap && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500" /><span>תקין</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-500" /><span>סטייה</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500" /><span>חריגה</span></div>
          </>
        )}
      </div>

      {symmetryScore !== undefined && (
        <div className="text-center text-xs text-muted-foreground">
          ציון סימטריה: <span className="font-bold text-foreground">{symmetryScore}%</span>
        </div>
      )}
    </div>
  );
});

useGLTF.preload("/models/Horse.glb");
