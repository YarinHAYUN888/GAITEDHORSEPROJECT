import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useHorses } from "@/hooks/useHorses";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HorseContext {
  name: string;
  breed: string | null;
  dmrt3: string | null;
  latestGaitScore: number | null;
  latestSymmetry: number | null;
  isDirty: boolean;
  lamenessRisk: string | null;
  recentTrainings: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/genetics-chat`;

export default function GeneticsExpert() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");
  const [horseContext, setHorseContext] = useState<HorseContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { horses } = useHorses();
  const { t } = useLanguage();

  const suggestedQuestions = [
    t("genex.q1"),
    t("genex.q2"),
    t("genex.q3"),
    t("genex.q4"),
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleHorseSelect = async (horseId: string) => {
    setSelectedHorseId(horseId);
    if (!horseId || horseId === "none") {
      setHorseContext(null);
      return;
    }
    const horse = horses.find((h) => h.id === horseId);
    if (!horse) return;

    const { data: gaitData } = await supabase
      .from("gait_analyses")
      .select("overall_score, symmetry_score, is_dirty, lameness_risk")
      .eq("horse_id", horseId)
      .order("created_at", { ascending: false })
      .limit(1);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count } = await supabase
      .from("training_logs")
      .select("id", { count: "exact", head: true })
      .eq("horse_id", horseId)
      .gte("date", sevenDaysAgo.toISOString().split("T")[0]);

    const latest = gaitData?.[0];
    setHorseContext({
      name: horse.name,
      breed: horse.breed_id,
      dmrt3: horse.dmrt3_genotype,
      latestGaitScore: latest?.overall_score ?? null,
      latestSymmetry: latest?.symmetry_score ?? null,
      isDirty: latest?.is_dirty ?? false,
      lamenessRisk: latest?.lameness_risk ?? null,
      recentTrainings: count ?? 0,
    });
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Message = { role: "user", content: messageText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          horseContext: horseContext || undefined,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData.error || (resp.status === 429 ? t("genex.errorRateLimit") : resp.status === 402 ? t("genex.errorPayment") : t("genex.errorAI"));
        toast({ title: t("genex.error"), description: errMsg, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsertAssistant = (nextChunk: string) => {
        assistantSoFar += nextChunk;
        const content = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      console.error("SSE error:", e);
      toast({ title: t("genex.error"), description: t("genex.errorConnection"), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12">
      <div className="container max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <MessageCircle className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl md:text-4xl font-rubik font-bold mb-3">{t("genex.title")}</h1>
          <p className="text-muted-foreground text-lg">{t("genex.subtitle")}</p>
        </motion.div>

        <div className="mb-4 flex items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">{t("genex.horseContext")}</label>
          <Select value={selectedHorseId} onValueChange={handleHorseSelect}>
            <SelectTrigger className="w-64 min-h-[44px]"><SelectValue placeholder={t("genex.selectHorse")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("genex.noContext")}</SelectItem>
              {horses.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}{h.dmrt3_genotype ? ` (${h.dmrt3_genotype})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {horseContext && (
            <span className="text-xs text-muted-foreground">
              {t("genex.score")}: {horseContext.latestGaitScore ?? "—"} | {t("genex.symmetryLabel")}: {horseContext.latestSymmetry ?? "—"}
            </span>
          )}
        </div>

        <div className="glass-card overflow-hidden flex flex-col" style={{ height: "60vh" }}>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="h-8 w-8 text-primary/40 mx-auto mb-4" />
                <p className="text-muted-foreground mb-6">{t("genex.emptyState")}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((q) => (
                    <button key={q} onClick={() => handleSend(q)} className="text-xs bg-muted hover:bg-muted/80 px-3 py-2 rounded-full transition-colors text-muted-foreground hover:text-foreground min-h-[44px]">{q}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-primary/15" : "bg-muted"}`}>
                  {msg.role === "user" ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {msg.role === "assistant" ? (<div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>) : msg.content}
                </div>
              </motion.div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Bot className="h-4 w-4 text-muted-foreground" /></div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("genex.inputPlaceholder")} className="min-h-[44px] max-h-32 resize-none" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
              <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="min-h-[44px] min-w-[44px]" aria-label={t("genex.sendLabel")}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
