import type { ReactNode } from "react";
import { Gauge, GitPullRequest, Layers3, ShieldCheck, TimerReset } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { IssueRecommendation, ScoreSection } from "@/lib/types";

type ExplanationDrawerProps = {
  issue: IssueRecommendation | null;
  onOpenChange: (open: boolean) => void;
};

function BreakdownRow({
  label,
  value,
  weightedPoints,
  detail,
  icon,
}: {
  label: string;
  value: number;
  weightedPoints: number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[22px] border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-border bg-muted/60 p-2 text-primary">{icon}</div>
          <div>
            <p className="font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{Math.round(value)}%</p>
          <p className="text-xs text-muted-foreground">{weightedPoints.toFixed(1)} pts</p>
        </div>
      </div>
      <Progress value={value} />
    </div>
  );
}

function commaSection(values?: string[]) {
  return values && values.length > 0 ? values.join(", ") : "No direct overlap yet";
}

function buildDetail(issue: IssueRecommendation, sectionKey: keyof IssueRecommendation["score_breakdown"]) {
  const section = issue.score_breakdown[sectionKey] as ScoreSection;

  if (sectionKey === "skill_strength") {
    const skillScores = Object.entries(section.skill_scores ?? {})
      .map(([skill, score]) => `${skill} ${score}%`)
      .join(", ");
    return `Weighted skill confidence: ${skillScores || "No direct overlap yet"}. Missing skills: ${commaSection(section.missing_skills)}.`;
  }

  if (sectionKey === "difficulty_fit") {
    return `Preferred: ${section.user_preference}. Issue level: ${section.issue_difficulty}.`;
  }

  if (sectionKey === "interest_alignment") {
    return `Interest overlap: ${commaSection(section.matched_interests)}. Issue focus: ${commaSection(section.focus_areas)}.`;
  }

  if (sectionKey === "issue_quality") {
    return `Issue quality score: ${section.issue_quality_score}. Labels attached: ${section.labels_count}.`;
  }

  return `Open for ${section.days_open} days. Last active ${section.days_since_update} days ago. Comments: ${section.comments}.`;
}

export function ExplanationDrawer({ issue, onOpenChange }: ExplanationDrawerProps) {
  return (
    <Dialog open={Boolean(issue)} onOpenChange={onOpenChange}>
      <DialogContent className="left-auto right-0 top-0 h-screen w-full max-w-[560px] translate-x-0 translate-y-0 rounded-none border-l border-border p-0">
        {issue && (
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-border bg-card px-6 py-6">
              <div className="inline-flex w-fit items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Match breakdown
              </div>
              <DialogTitle className="pt-3 text-2xl leading-tight">{issue.issue_title}</DialogTitle>
              <DialogDescription>
                {issue.repository} • {Math.round(issue.match_score)}% overall match
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto bg-background px-6 py-6">
              <BreakdownRow
                label="Skill Strength"
                value={issue.score_breakdown.skill_strength.score}
                weightedPoints={issue.score_breakdown.skill_strength.weighted_points}
                detail={buildDetail(issue, "skill_strength")}
                icon={<Layers3 className="h-4 w-4" />}
              />
              <BreakdownRow
                label="Difficulty Fit"
                value={issue.score_breakdown.difficulty_fit.score}
                weightedPoints={issue.score_breakdown.difficulty_fit.weighted_points}
                detail={buildDetail(issue, "difficulty_fit")}
                icon={<Gauge className="h-4 w-4" />}
              />
              <BreakdownRow
                label="Interest Alignment"
                value={issue.score_breakdown.interest_alignment.score}
                weightedPoints={issue.score_breakdown.interest_alignment.weighted_points}
                detail={buildDetail(issue, "interest_alignment")}
                icon={<GitPullRequest className="h-4 w-4" />}
              />
              <BreakdownRow
                label="Issue Quality"
                value={issue.score_breakdown.issue_quality.score}
                weightedPoints={issue.score_breakdown.issue_quality.weighted_points}
                detail={buildDetail(issue, "issue_quality")}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <BreakdownRow
                label="Recency & Activity"
                value={issue.score_breakdown.recency_activity.score}
                weightedPoints={issue.score_breakdown.recency_activity.weighted_points}
                detail={buildDetail(issue, "recency_activity")}
                icon={<TimerReset className="h-4 w-4" />}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
