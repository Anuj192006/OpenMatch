import { ExternalLink, LoaderCircle, ScanSearch, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnhancedExplanation, IssueRecommendation } from "@/lib/types";

type RecommendationCardProps = {
  issue: IssueRecommendation;
  enhancedExplanation?: EnhancedExplanation;
  enhancing: boolean;
  onOpenBreakdown: (issue: IssueRecommendation) => void;
  onEnhance: (issue: IssueRecommendation) => void;
};

export function RecommendationCard({
  issue,
  enhancedExplanation,
  enhancing,
  onOpenBreakdown,
  onEnhance,
}: RecommendationCardProps) {
  const skillFitEntries = Object.entries(issue.score_breakdown.skill_strength.skill_scores ?? {}).filter(
    ([, score]) => score > 0
  );

  return (
    <Card className="border-white/70 bg-white/95 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-shell">
      <CardHeader className="gap-4 border-b border-border/80 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px] tracking-wide text-muted-foreground">
                {issue.repository}
              </Badge>
              <Badge>{Math.round(issue.match_score)}% match</Badge>
            </div>
            <CardTitle className="max-w-3xl text-2xl leading-tight">{issue.issue_title}</CardTitle>
          </div>
          <div className="rounded-[22px] border border-border bg-muted/50 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estimated effort</div>
            <div className="mt-1 text-base font-semibold text-foreground">{issue.estimated_effort}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <p className="text-sm leading-7 text-muted-foreground">{issue.issue_description}</p>

        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Required skills</p>
              <div className="flex flex-wrap gap-2">
                {issue.required_skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">User skill fit</p>
              <div className="flex flex-wrap gap-2">
                {skillFitEntries.length > 0 ? (
                  skillFitEntries.map(([skill, score]) => (
                    <Badge key={skill} variant="outline">
                      {skill} {score}%
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No direct skill overlap yet</span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Labels</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{issue.difficulty}</Badge>
                {issue.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-muted/35 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Target className="h-4 w-4 text-primary" />
              Why it landed high
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{issue.why_recommended}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Skill fit: {Math.round(issue.score_breakdown.skill_strength.score)}%</span>
              <span>Difficulty fit: {Math.round(issue.score_breakdown.difficulty_fit.score)}%</span>
              <span>Recency: {Math.round(issue.score_breakdown.recency_activity.score)}%</span>
            </div>
          </div>
        </div>

        {enhancedExplanation && (
          <div className="rounded-[24px] border border-primary/15 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {enhancedExplanation.mode === "groq" ? "Enhanced explanation" : "Deterministic fallback"}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{enhancedExplanation.enhanced_summary}</p>
            <p className="mt-3 text-sm leading-6 text-foreground">{enhancedExplanation.personalized_reason}</p>
            <div className="mt-3 rounded-2xl border border-primary/10 bg-white/70 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Suggested first step:</span> {enhancedExplanation.suggested_first_step}
            </div>
            {enhancedExplanation.message && <p className="mt-3 text-xs text-muted-foreground">{enhancedExplanation.message}</p>}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" onClick={() => onOpenBreakdown(issue)}>
            <ScanSearch className="h-4 w-4" />
            View Breakdown
          </Button>
          <Button type="button" variant="outline" onClick={() => onEnhance(issue)} disabled={enhancing}>
            {enhancing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {enhancing ? "Enhancing Explanation" : "Enhance Explanation"}
          </Button>
          <Button asChild>
            <a href={issue.url} target="_blank" rel="noreferrer">
              Open Issue
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
