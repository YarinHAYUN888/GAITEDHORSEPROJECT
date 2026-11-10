import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Star, MessageSquare, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { submitFeedback } from "@/services/feedbackService";
import { useLanguage } from "@/contexts/LanguageContext";
import { feedbackSchema } from "@/lib/validationSchemas";

interface Props {
  analysisId?: string;
  detectedGaitType?: string;
  detectedGaitTypeHebrew?: string;
  humanValidated?: boolean;
  onFeedbackSubmitted?: () => void;
}

export default function FeedbackPanel({
  analysisId,
  detectedGaitType,
  detectedGaitTypeHebrew,
  humanValidated,
  onFeedbackSubmitted,
}: Props) {
  const { t, dir } = useLanguage();
  const [isGaitCorrect, setIsGaitCorrect] = useState<boolean | null>(null);
  const [correctedGait, setCorrectedGait] = useState<string>("");
  const [recommendationRating, setRecommendationRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const GAIT_TYPES = [
    { value: "walk", label: t("fb.walk") },
    { value: "trot", label: t("fb.trot") },
    { value: "canter", label: t("fb.canter") },
    { value: "gallop", label: t("fb.gallop") },
    { value: "tolt", label: t("fb.tolt") },
    { value: "pace", label: t("fb.pace") },
    { value: "running_walk", label: t("fb.runningWalk") },
    { value: "fox_trot", label: t("fb.foxTrot") },
  ];

  if (!analysisId) return null;

  const handleSubmit = async () => {
    if (!analysisId) return;
    const parsed = feedbackSchema.safeParse({
      isGaitCorrect,
      correctedGait,
      recommendationRating,
      comment,
    });
    if (!parsed.success) {
      toast({ title: t("fb.fillAtLeastOne"), variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const promises: Promise<unknown>[] = [];

      if (isGaitCorrect === false && correctedGait) {
        promises.push(
          submitFeedback({
            analysisId,
            feedbackType: "gait_correction",
            correctedGaitType: correctedGait,
          })
        );
      }

      if (isGaitCorrect === true) {
        promises.push(
          submitFeedback({
            analysisId,
            feedbackType: "gait_correction",
            correctedGaitType: detectedGaitType,
            comment: t("fb.gaitConfirm"),
          })
        );
      }

      if (recommendationRating > 0) {
        promises.push(
          submitFeedback({
            analysisId,
            feedbackType: "recommendation_rating",
            rating: recommendationRating,
          })
        );
      }

      if (comment.trim()) {
        promises.push(
          submitFeedback({
            analysisId,
            feedbackType: "general",
            comment: comment.trim(),
          })
        );
      }

      if (promises.length === 0) {
        toast({ title: t("fb.fillAtLeastOne"), variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      await Promise.all(promises);
      setSubmitted(true);
      toast({ title: t("fb.successTitle"), description: t("fb.successDesc") });
      onFeedbackSubmitted?.();
    } catch (err: any) {
      toast({ title: t("fb.errorTitle"), description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted || humanValidated) {
    return (
      <Card className="border-primary/30 bg-primary/5" dir={dir}>
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <p className="font-medium text-primary">{t("fb.validated")}</p>
            <p className="text-xs text-muted-foreground">{t("fb.validatedDesc")}</p>
          </div>
          <Badge variant="outline" className="mr-auto bg-primary/10 text-primary border-primary/30">
            <ShieldCheck className="h-3 w-3 ml-1" /> {t("fb.verifiedBadge")}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20" dir={dir}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t("fb.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gait type verification */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t("fb.gaitCorrect")}{" "}
            <Badge variant="secondary">{detectedGaitTypeHebrew || detectedGaitType || t("fb.notDetected")}</Badge>
          </p>
          <div className="flex gap-2">
            <Button
              variant={isGaitCorrect === true ? "default" : "outline"}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setIsGaitCorrect(true)}
            >
              <CheckCircle className="h-4 w-4 ml-1" /> {t("fb.correct")}
            </Button>
            <Button
              variant={isGaitCorrect === false ? "destructive" : "outline"}
              size="sm"
              className="min-h-[44px]"
              onClick={() => setIsGaitCorrect(false)}
            >
              <XCircle className="h-4 w-4 ml-1" /> {t("fb.incorrect")}
            </Button>
          </div>
          {isGaitCorrect === false && (
            <Select value={correctedGait} onValueChange={setCorrectedGait}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t("fb.selectCorrectGait")} />
              </SelectTrigger>
              <SelectContent>
                {GAIT_TYPES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Recommendation rating */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("fb.rateQuality")}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRecommendationRating(n === recommendationRating ? 0 : n)}
                className="p-1 transition-colors"
                aria-label={`${n}`}
              >
                <Star
                  className={`h-6 w-6 ${n <= recommendationRating ? "fill-accent text-accent" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("fb.additionalNotes")}</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("fb.notesPlaceholder")}
            className="resize-none"
            rows={2}
          />
        </div>

        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full min-h-[44px]">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <MessageSquare className="h-4 w-4 ml-2" />}
          {t("fb.submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
