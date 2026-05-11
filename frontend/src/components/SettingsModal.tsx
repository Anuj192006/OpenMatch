import * as React from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SettingsValues } from "@/lib/types";

type SettingsModalProps = {
  open: boolean;
  currentGroqKey: string;
  currentGithubToken: string;
  notice?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (values: SettingsValues) => void;
  onClear: () => void;
};

export function SettingsModal({
  open,
  currentGroqKey,
  currentGithubToken,
  notice,
  onOpenChange,
  onSave,
  onClear,
}: SettingsModalProps) {
  const [draftGroqKey, setDraftGroqKey] = React.useState(currentGroqKey);
  const [draftGithubToken, setDraftGithubToken] = React.useState(currentGithubToken);

  React.useEffect(() => {
    setDraftGroqKey(currentGroqKey);
    setDraftGithubToken(currentGithubToken);
  }, [currentGroqKey, currentGithubToken, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            API Key Settings
          </div>
          <DialogTitle className="pt-3">Optional API settings</DialogTitle>
          <DialogDescription>
            OpenMatch can optionally use your Groq key for richer explanations and your GitHub token for higher live API limits.
          </DialogDescription>
        </DialogHeader>

        {notice && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div>}

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Groq API key</label>
          <Input
            type="password"
            placeholder="gsk_..."
            value={draftGroqKey}
            onChange={(event) => setDraftGroqKey(event.target.value)}
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">GitHub token</label>
          <Input
            type="password"
            placeholder="ghp_... or fine-grained token"
            value={draftGithubToken}
            onChange={(event) => setDraftGithubToken(event.target.value)}
          />
          <p className="text-sm leading-6 text-muted-foreground">
            Optional. OpenMatch uses this only for live GitHub issue fetching when you paste a repo or organization URL.
          </p>
        </div>

        <div className="rounded-[22px] border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-border bg-card p-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Privacy note</p>
              <p>
                OpenMatch keeps ranking deterministic and stores both keys only in your browser. Neither key is ever saved on the backend.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setDraftGroqKey("");
              setDraftGithubToken("");
              onClear();
            }}
          >
            Clear stored keys
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave({
                groqKey: draftGroqKey.trim(),
                githubToken: draftGithubToken.trim(),
              });
              onOpenChange(false);
            }}
          >
            Save locally
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
