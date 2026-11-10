import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Bot, User, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface Horse {
  id: string;
  name: string;
  breed_id: string | null;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/horse-coach-chat`;

export default function HorseCoachChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [selectedHorseId, setSelectedHorseId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("horses").select("id, name, breed_id").eq("user_id", user.id).order("name").then(({ data }) => {
      if (data) setHorses(data);
    });
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          horseId: selectedHorseId || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "שגיאה" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (true) {
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
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "שגיאה בצ'אט");
      setMessages(prev => prev.filter(m => m !== userMsg));
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, selectedHorseId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* FAB */}
      <AnimatePresence mode="wait">
        {!open && (
          <motion.div
            key="coach-fab"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="fixed bottom-20 left-4 z-50 md:bottom-6 md:left-6"
          >
            <Button
              onClick={() => setOpen(true)}
              size="lg"
              className="rounded-full h-14 w-14 shadow-lg bg-primary hover:bg-primary/90"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key="coach-panel"
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-20 left-4 right-4 z-50 md:bottom-6 md:left-6 md:right-auto md:w-[420px]"
          >
            <div className="bg-card border border-border rounded-xl shadow-2xl flex flex-col h-[500px] max-h-[80vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">מאמן AI אישי</span>
                  <Badge variant="outline" className="text-xs">RAG</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Horse selector */}
              <div className="p-2 border-b">
                <Select value={selectedHorseId} onValueChange={setSelectedHorseId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="בחר סוס לשיחה מותאמת..." />
                  </SelectTrigger>
                  <SelectContent>
                    {horses.map(h => (
                      <SelectItem key={h.id} value={h.id} className="text-xs">
                        {h.name} {h.breed_id ? `(${h.breed_id})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <Bot className="h-10 w-10 mx-auto mb-3 text-primary/40" />
                    <p>שלום! אני המאמן AI שלך 🐴</p>
                    <p className="text-xs mt-1">בחר סוס ושאל אותי כל שאלה</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 mb-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2 mb-3">
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="h-3 w-3" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </ScrollArea>

              {/* Input */}
              <div className="p-2 border-t flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="שאל את המאמן..."
                  className="min-h-[36px] max-h-[80px] text-sm resize-none"
                  rows={1}
                />
                <Button
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={send}
                  disabled={!input.trim() || loading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
