import jsPDF from "jspdf";
import type { EnrichedGaitResult } from "@/types/gait";

// Amiri font is not bundled — we use jsPDF's built-in fonts with RTL workaround
// Hebrew text is reversed for display since jsPDF doesn't natively support RTL

function reverseHebrew(text: string): string {
  // Split into segments: Hebrew vs non-Hebrew
  const segments = text.match(/[\u0590-\u05FF\uFB1D-\uFB4F]+|[^\u0590-\u05FF\uFB1D-\uFB4F]+/g) || [text];
  return segments.reverse().map(seg => {
    if (/[\u0590-\u05FF]/.test(seg)) {
      return seg.split("").reverse().join("");
    }
    return seg;
  }).join("");
}

interface PDFReportOptions {
  result: EnrichedGaitResult;
  horseName?: string;
  lang?: "he" | "en";
}

const COLORS = {
  primary: [194, 145, 56] as [number, number, number],    // gold
  dark: [26, 26, 26] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  bg: [245, 243, 238] as [number, number, number],
  green: [34, 139, 34] as [number, number, number],
  red: [200, 60, 60] as [number, number, number],
  blue: [60, 100, 180] as [number, number, number],
};

function scoreColor(score: number): [number, number, number] {
  if (score >= 75) return COLORS.green;
  if (score >= 50) return COLORS.primary;
  return COLORS.red;
}

export function generateGaitPDFReport({ result, horseName, lang = "he" }: PDFReportOptions): jsPDF {
  const isHe = lang === "he";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = 0;

  const t = (he: string, en: string) => isHe ? he : en;

  // ──────── Header Band ────────
  doc.setFillColor(...COLORS.dark);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 38, pageW, 2, "F");

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.primary);
  const title = t("סוסי צעד — דוח ניתוח תנועה", "GaitIQ — Gait Analysis Report");
  doc.text(isHe ? reverseHebrew(title) : title, pageW / 2, 18, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  const subtitle = horseName
    ? t(`סוס: ${horseName}`, `Horse: ${horseName}`)
    : t("דוח ניתוח ביומכני", "Biomechanical Analysis Report");
  doc.text(isHe ? reverseHebrew(subtitle) : subtitle, pageW / 2, 28, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  const dateStr = new Date().toLocaleDateString(isHe ? "he-IL" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(dateStr, pageW / 2, 34, { align: "center" });

  y = 48;

  // ──────── Score Overview Section ────────
  const drawScoreBox = (label: string, value: number | string, x: number, w: number, color: [number, number, number]) => {
    doc.setFillColor(250, 248, 244);
    doc.roundedRect(x, y, w, 28, 3, 3, "F");
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, 28, 3, 3, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...color);
    doc.text(String(value), x + w / 2, y + 13, { align: "center" });

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(isHe ? reverseHebrew(label) : label, x + w / 2, y + 22, { align: "center" });
  };

  const boxW = (contentW - 8) / 3;
  drawScoreBox(
    t("ציון כולל", "Overall Score"),
    result.overallScore,
    margin,
    boxW,
    scoreColor(result.overallScore)
  );
  drawScoreBox(
    t("ביטחון", "Confidence"),
    `${result.confidence}%`,
    margin + boxW + 4,
    boxW,
    scoreColor(result.confidence)
  );
  drawScoreBox(
    t("סימטריה", "Symmetry"),
    result.symmetry.score,
    margin + (boxW + 4) * 2,
    boxW,
    scoreColor(result.symmetry.score)
  );

  y += 34;

  // ──────── Gait Classification ────────
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(margin, y, contentW, 18, 3, 3, "F");
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  const gaitLabel = isHe
    ? reverseHebrew(`${result.gaitTypeHebrew} (${result.gaitType})`)
    : `${result.gaitType} (${result.gaitTypeHebrew})`;
  doc.text(gaitLabel, pageW / 2, y + 11, { align: "center" });
  y += 24;

  // ──────── Beat Pattern & Sync ────────
  const sectionTitle = (title: string) => {
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text(isHe ? reverseHebrew(title) : title, isHe ? pageW - margin : margin, y, { align: isHe ? "right" : "left" });
    y += 2;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
  };

  const addRow = (label: string, value: string) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(isHe ? reverseHebrew(label) : label, isHe ? pageW - margin : margin, y, { align: isHe ? "right" : "left" });
    doc.setTextColor(...COLORS.dark);
    doc.setFont("Helvetica", "bold");
    doc.text(isHe ? reverseHebrew(value) : value, isHe ? margin : pageW - margin, y, { align: isHe ? "left" : "right" });
    y += 6;
  };

  sectionTitle(t("פרטי ניתוח", "Analysis Details"));
  addRow(t("דפוס פעימות", "Beat Pattern"), result.beatPattern);
  addRow(t("סנכרון לטרלי", "Lateral Sync"), `${result.lateralSync.percentage}%`);
  addRow(t("איכות מתיחה", "Extension Quality"), result.extension.quality);
  addRow(t("סיכון לצליעה", "Lameness Risk"), result.symmetry.lamenessRisk);

  if (result.audioAnalysis) {
    addRow(t("BPM שנמדד", "Detected BPM"), String(result.audioAnalysis.detectedBPM));
    addRow(t("סדירות מקצב", "Rhythm Regularity"), `${result.audioAnalysis.rhythmRegularity}%`);
  }

  y += 4;

  // ──────── Biomechanical Metrics ────────
  if (result.biomechMetrics?.gait || result.kinematicMetrics) {
    sectionTitle(t("מדדים ביומכניים", "Biomechanical Metrics"));

    if (result.kinematicMetrics?.strideLength) {
      addRow(t("אורך צעד שמאל", "Stride Length L"), `${result.kinematicMetrics.strideLength.left.toFixed(1)} px`);
      addRow(t("אורך צעד ימין", "Stride Length R"), `${result.kinematicMetrics.strideLength.right.toFixed(1)} px`);
      addRow(t("אסימטריה", "Asymmetry"), `${result.kinematicMetrics.strideLength.asymmetryPercent.toFixed(1)}%`);
    }

    if (result.biomechMetrics?.windows && result.biomechMetrics.windows.length > 0) {
      const avgQuality = result.biomechMetrics.windows.reduce((s, w) => s + w.quality, 0) / result.biomechMetrics.windows.length;
      addRow(t("איכות חלונות ממוצעת", "Avg Window Quality"), `${(avgQuality * 100).toFixed(0)}%`);
      addRow(t("מספר חלונות", "Windows Count"), String(result.biomechMetrics.windows.length));
    }

    y += 4;
  }

  // ──────── Multi-Modal Fusion ────────
  if (result.multiModalFusion) {
    sectionTitle(t("שילוב מולטי-מודאלי", "Multi-Modal Fusion"));
    addRow(t("הסכמה", "Agreement"), result.multiModalFusion.agreement ? "✓" : "✗");
    addRow(t("ביטחון משוקלל", "Fused Confidence"), `${result.multiModalFusion.fusedConfidence}%`);
    if (!result.multiModalFusion.agreement) {
      addRow(t("ויז'ן", "Vision"), result.multiModalFusion.visionGaitType);
      addRow(t("אודיו", "Audio"), result.multiModalFusion.audioGaitType);
    }
    y += 4;
  }

  // ──────── Decision & Quality Seal ────────
  if (result.decision || result.qualitySealLevel) {
    sectionTitle(t("החלטה ואיכות", "Decision & Quality"));
    if (result.decision) {
      addRow(t("תוצאה", "Outcome"), result.decision.outcome);
      if (result.decision.reasonCodes?.length) {
        addRow(t("קודי סיבה", "Reason Codes"), result.decision.reasonCodes.join(", "));
      }
    }
    if (result.qualitySealLevel) {
      addRow(t("רמת חותם איכות", "Quality Seal"), result.qualitySealLevel);
      if (result.qualitySealScore != null) {
        addRow(t("ציון חותם", "Seal Score"), String(result.qualitySealScore));
      }
    }
    y += 4;
  }

  // ──────── Summary ────────
  if (y > 240) { doc.addPage(); y = 20; }
  sectionTitle(t("סיכום", "Summary"));
  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  const summaryLines = doc.splitTextToSize(
    isHe ? reverseHebrew(result.summary) : result.summary,
    contentW
  );
  doc.text(summaryLines, isHe ? pageW - margin : margin, y, { align: isHe ? "right" : "left" });
  y += summaryLines.length * 4.5 + 6;

  // ──────── Training Recommendations ────────
  if (result.trainingRecommendations?.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    sectionTitle(t("המלצות אימון", "Training Recommendations"));
    result.trainingRecommendations.forEach((rec, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const text = typeof rec === "string" ? rec : rec.title;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.dark);
      const recText = `${i + 1}. ${isHe ? reverseHebrew(text) : text}`;
      const lines = doc.splitTextToSize(recText, contentW - 4);
      doc.text(lines, isHe ? pageW - margin : margin, y, { align: isHe ? "right" : "left" });
      y += lines.length * 4.5 + 2;
    });
  }

  // ──────── Footer ────────
  const addFooter = (pageNum: number) => {
    const totalPages = doc.getNumberOfPages();
    doc.setPage(pageNum);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageW - margin, footerY - 4);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(`GaitIQ Report — ${new Date().toISOString().slice(0, 10)}`, margin, footerY);
    doc.text(`${pageNum} / ${totalPages}`, pageW - margin, footerY, { align: "right" });
  };

  for (let i = 1; i <= doc.getNumberOfPages(); i++) {
    addFooter(i);
  }

  return doc;
}

export function downloadGaitPDF(options: PDFReportOptions) {
  const doc = generateGaitPDFReport(options);
  const filename = `gait-report-${options.horseName || "analysis"}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
