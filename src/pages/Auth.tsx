import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Globe } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { loginSchema, signupSchema } from "@/lib/validationSchemas";

export default function Auth() {
  const { user, loading: authLoading } = useAuth();
  const { t, lang, dir, toggleLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState("login");
  const { toast } = useToast();

  const getAuthErrorMessage = (message: string) => {
    if (message === "Invalid login credentials") return t("auth.invalidCredentials");
    if (message === "Email not confirmed") return t("auth.emailNotConfirmed");
    if (message.includes("Failed to fetch") || message.includes("AuthRetryableFetchError")) {
      return lang === "he"
        ? "לא ניתן להתחבר לשרת כרגע. רענן את הדף ונסה שוב בעוד כמה שניות."
        : "Cannot reach the server right now. Refresh the page and try again in a few seconds.";
    }
    return message;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("auth.loading")}</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast({ title: t("auth.loginError"), description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    setLoading(false);
    if (error) {
      if (error.message.includes("Failed to fetch") || error.message.includes("AuthRetryableFetchError")) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      toast({
        title: t("auth.loginError"),
        description: getAuthErrorMessage(error.message),
        variant: "destructive",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      toast({ title: t("auth.signupError"), description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data: isAllowed, error: checkError } = await supabase.rpc("is_email_allowed", { _email: email });

    if (checkError || !isAllowed) {
      setLoading(false);
      toast({
        title: t("auth.signupNotAllowed"),
        description: t("auth.emailNotInvited"),
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: t("auth.signupError"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("auth.signupSuccess"), description: t("auth.checkEmail") });
      setTab("login");
    }
  };

  const PasswordInput = ({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string }) => (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        dir="ltr"
        className="pl-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        tabIndex={-1}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Language toggle on auth page */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <Globe className="h-4 w-4" />
            {t("lang.switchTo")}
          </Button>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center pb-4">
            <div className="text-5xl mb-3" aria-hidden="true">🐴</div>
            <CardTitle className="text-2xl font-rubik text-gradient-gold">{t("app.name")}</CardTitle>
            <CardDescription className="text-base">{t("auth.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} dir={dir}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" className="min-h-[40px]">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="signup" className="min-h-[40px]">{t("auth.signup")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t("auth.email")}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      dir="ltr"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t("auth.password")}</Label>
                    <PasswordInput
                      id="login-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                  <Button type="submit" className="w-full min-h-[44px] text-base font-semibold" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    {t("auth.loginBtn")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-sm text-muted-foreground">{t("auth.inviteOnly")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">{t("auth.displayName")}</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t("auth.namePlaceholder")}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">{t("auth.email")}</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      dir="ltr"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">{t("auth.password")}</Label>
                    <PasswordInput
                      id="signup-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.passwordMinChars")}
                    />
                    {password.length > 0 && password.length < 6 && (
                      <p className="text-xs text-destructive">{t("auth.passwordTooShort")}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full min-h-[44px] text-base font-semibold" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    {t("auth.signupBtn")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t("auth.terms")}
        </p>
      </div>
    </div>
  );
}
