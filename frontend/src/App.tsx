import { startTransition, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  KeyRound,
  LayoutPanelTop,
  LoaderCircle,
  Sparkles,
  Target,
} from "lucide-react";

import { ExplanationDrawer } from "@/components/ExplanationDrawer";
import { OnboardingPanel } from "@/components/OnboardingPanel";
import { RecommendationCard } from "@/components/RecommendationCard";
import { SettingsModal } from "@/components/SettingsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  EnhancedExplanation,
  IssueRecommendation,
  RecommendationResponse,
  SettingsValues,
  SourceMeta,
  UserProfile,
} from "@/lib/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const GROQ_STORAGE_KEY = "openmatch-groq-api-key";
const GITHUB_TOKEN_STORAGE_KEY = "openmatch-github-token";

function getLoadingMessages(hasGitHubSource: boolean) {
  return hasGitHubSource
    ? ["Fetching real GitHub issues...", "Inferring issue skills", "Ranking real issue matches"]
    : ["Matching your profile", "Ranking issue fit", "Looking for realistic wins"];
}

const defaultProfile: UserProfile = {
  skills: {},
  experience_level: "Beginner",
  open_source_experience: "Never Contributed",
  interests: [],
  preferred_difficulty: "Good First Issue",
  github_username: "",
};

function App() {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [githubUrl, setGithubUrl] = useState("");
  const [recommendations, setRecommendations] = useState<IssueRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(getLoadingMessages(false)[0]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState("");
  const [sourceNotice, setSourceNotice] = useState("");
  const [sourceMeta, setSourceMeta] = useState<SourceMeta | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<IssueRecommendation | null>(null);
  const [groqKey, setGroqKey] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [enhancingUrl, setEnhancingUrl] = useState("");
  const [enhancedExplanations, setEnhancedExplanations] = useState<Record<string, EnhancedExplanation>>({});
  const resultsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const storedKey = window.localStorage.getItem(GROQ_STORAGE_KEY) ?? "";
    const storedGithubToken = window.localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) ?? "";
    setGroqKey(storedKey);
    setGithubToken(storedGithubToken);
  }, []);

  useEffect(() => {
    const loadingMessages = getLoadingMessages(Boolean(githubUrl.trim()));
    if (!loading) {
      setLoadingMessage(loadingMessages[0]);
      return;
    }

    let index = 0;
    const interval = window.setInterval(() => {
      index = (index + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[index]);
    }, 1100);

    return () => window.clearInterval(interval);
  }, [loading, githubUrl]);

  function handleProfileChange(patch: Partial<UserProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  async function handleRecommend() {
    setLoading(true);
    setError("");
    setSourceNotice("");
    setSourceMeta(null);
    setSelectedIssue(null);
    setEnhancedExplanations({});
    setRecommendations([]);

    try {
      const hasGitHubSource = Boolean(githubUrl.trim());
      const response = await fetch(`${API_URL}${hasGitHubSource ? "/recommend-from-github" : "/recommend"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(hasGitHubSource && githubToken ? { "x-github-token": githubToken } : {}),
        },
        body: JSON.stringify(
          hasGitHubSource
            ? {
                github_url: githubUrl.trim(),
                user_profile: profile,
              }
            : profile
        ),
      });

      if (!response.ok) {
        let detail = "Unable to fetch recommendations.";
        try {
          const payload = (await response.json()) as { detail?: string };
          if (payload.detail) {
            detail = payload.detail;
          }
        } catch {
          // ignore JSON parsing failure and use default detail
        }
        throw new Error(detail);
      }

      const data = (await response.json()) as RecommendationResponse;
      startTransition(() => {
        setRecommendations(data.recommendations);
        setHasSearched(true);
        setSourceMeta({
          source: data.source,
          issuesCount: data.issues_count,
          issuesFetched: data.issues_fetched,
          usedFallback: data.used_fallback,
          fallbackReason: data.fallback_reason ?? undefined,
          sourceKind: data.source_kind,
          message: data.message ?? undefined,
        });
        setSourceNotice(data.message ?? (data.used_fallback && data.fallback_reason ? data.fallback_reason : ""));
      });

      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to fetch recommendations.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnhance(issue: IssueRecommendation) {
    if (!groqKey) {
      setSettingsNotice("Add your Groq API key to enable enhanced issue explanations.");
      setSettingsOpen(true);
      return;
    }

    setEnhancingUrl(issue.url);

    try {
      const response = await fetch(`${API_URL}/enhance-explanation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-groq-api-key": groqKey,
        },
        body: JSON.stringify({
          user_profile: profile,
          selected_issue: issue,
          score_breakdown: issue.score_breakdown,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to enhance explanation.");
      }

      const data = (await response.json()) as EnhancedExplanation;
      setEnhancedExplanations((current) => ({ ...current, [issue.url]: data }));
    } catch {
      setEnhancedExplanations((current) => ({
        ...current,
        [issue.url]: {
          enhanced_summary: issue.issue_description,
          personalized_reason: issue.why_recommended,
          suggested_first_step:
            "Read the issue end to end, reproduce the problem locally, and identify the smallest testable change first.",
          mode: "fallback",
          message: "The enhanced request failed, so OpenMatch kept the deterministic explanation intact.",
        },
      }));
    } finally {
      setEnhancingUrl("");
    }
  }

  function handleSaveSettings(values: SettingsValues) {
    window.localStorage.setItem(GROQ_STORAGE_KEY, values.groqKey);
    window.localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, values.githubToken);
    setGroqKey(values.groqKey);
    setGithubToken(values.githubToken);
    setSettingsNotice("");
  }

  function handleClearKeys() {
    window.localStorage.removeItem(GROQ_STORAGE_KEY);
    window.localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    setGroqKey("");
    setGithubToken("");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_right,_rgba(15,118,110,0.08),_transparent_34%),radial-gradient(circle_at_top_left,_rgba(37,99,235,0.06),_transparent_28%)]" />
      <div className="absolute inset-0 -z-20 bg-grid-soft bg-[size:34px_34px] opacity-70" />

      <header className="container pt-6">
        <div className="flex items-center justify-between rounded-full border border-white/80 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">OpenMatch AI</p>
              <p className="text-xs text-muted-foreground">Developer issue recommendations</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>
            <KeyRound className="h-4 w-4" />
            API Key Settings
          </Button>
        </div>
      </header>

      <main className="container pb-20 pt-8">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-8 pt-8 lg:pt-12">
            <div className="space-y-6">
              <Badge variant="outline" className="w-fit bg-white/70 text-foreground">
                Personalized GitHub issue discovery
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.6rem] lg:leading-[1.05]">
                  Find Open Source Issues You Can Actually Solve
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  Get personalized GitHub issue recommendations based on your skills, experience, and contribution goals.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <a href="#match-form">
                    Start Matching
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/80 px-4 py-3 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Real GitHub issue fetching with deterministic ranking
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-white/80 bg-white/85">
                <CardContent className="space-y-3 p-5">
                  <LayoutPanelTop className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Profile once</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Skills, experience, interests, and contribution comfort level.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/80 bg-white/85">
                <CardContent className="space-y-3 p-5">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Score with signal</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Weight real issue fit by skill strength, difficulty, alignment, quality, and recency.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/80 bg-white/85">
                <CardContent className="space-y-3 p-5">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Act faster</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">Open live GitHub issues, inspect the fit breakdown, and optionally request a clearer first step.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <OnboardingPanel
            profile={profile}
            githubUrl={githubUrl}
            loading={loading}
            onChange={handleProfileChange}
            onGitHubUrlChange={setGithubUrl}
            onSubmit={handleRecommend}
          />
        </section>

        <section ref={resultsRef} className="mt-14 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">Recommendation dashboard</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Ranked issue matches</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-border bg-white/80 px-4 py-2 text-sm text-muted-foreground">
                {groqKey ? "Groq enhancement ready" : "Groq enhancement disabled"}
              </div>
              <div className="rounded-full border border-border bg-white/80 px-4 py-2 text-sm text-muted-foreground">
                {githubToken ? "GitHub token ready" : "Using unauthenticated GitHub API"}
              </div>
            </div>
          </div>

          {error && <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">{error}</div>}
          {sourceNotice && <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">{sourceNotice}</div>}
          {sourceMeta && !loading && (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="rounded-full border border-border bg-white/80 px-4 py-2">
                Source: <span className="font-semibold text-foreground">{sourceMeta.source}</span>
              </div>
              <div className="rounded-full border border-border bg-white/80 px-4 py-2">
                Open issues considered: <span className="font-semibold text-foreground">{sourceMeta.issuesFetched}</span>
              </div>
              <div className="rounded-full border border-border bg-white/80 px-4 py-2">
                {sourceMeta.sourceKind === "mock" ? "Sample dataset active" : "Live GitHub source active"}
              </div>
            </div>
          )}

          {loading && (
            <div className="grid gap-5">
              <Card className="border-dashed border-border/90 bg-white/90">
                <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
                  <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">{loadingMessage}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {githubUrl.trim()
                        ? "Fetching open issues from GitHub, inferring skills, and ranking realistic matches."
                        : "Ranking issues across frontend, backend, ML, docs, testing, and tooling."}
                    </p>
                  </div>
                </CardContent>
              </Card>
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-56 animate-pulse rounded-[28px] border border-border bg-white/75 shadow-panel"
                />
              ))}
            </div>
          )}

          {!loading && hasSearched && recommendations.length === 0 && (
            <Card className="border-dashed border-border bg-white/90">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <Target className="h-8 w-8 text-primary" />
                <h3 className="text-2xl font-semibold text-foreground">
                  {sourceMeta?.sourceKind !== "mock" && sourceMeta?.issuesFetched === 0
                    ? "No open issues found from this GitHub source."
                    : "No strong matches found"}
                </h3>
                <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                  {sourceMeta?.sourceKind !== "mock" && sourceMeta?.issuesFetched === 0
                    ? "Try another repository or add a GitHub token if the organization has many repositories."
                    : "Try adjusting your skills, interests, or difficulty preference."}
                </p>
              </CardContent>
            </Card>
          )}

          {!loading && recommendations.length > 0 && (
            <div className="grid gap-5">
              {recommendations.map((issue) => (
                <RecommendationCard
                  key={issue.url}
                  issue={issue}
                  enhancedExplanation={enhancedExplanations[issue.url]}
                  enhancing={enhancingUrl === issue.url}
                  onOpenBreakdown={setSelectedIssue}
                  onEnhance={handleEnhance}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <ExplanationDrawer issue={selectedIssue} onOpenChange={(open) => !open && setSelectedIssue(null)} />
      <SettingsModal
        open={settingsOpen}
        currentGroqKey={groqKey}
        currentGithubToken={githubToken}
        notice={settingsNotice}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            setSettingsNotice("");
          }
        }}
        onSave={handleSaveSettings}
        onClear={handleClearKeys}
      />
    </div>
  );
}

export default App;
