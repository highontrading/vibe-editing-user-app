"use client";
import * as React from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { fetcher } from "@/lib/utils";
import { useEditor } from "@/lib/editor/store";
import type { MessageView, ProjectView } from "@/lib/editor/types";
import { Toaster } from "@/components/ui/toast";
import { TopBar } from "./top-bar";
import { Panel } from "./panel";
import { ChatPanel } from "./chat/chat-panel";
import { PreviewPanel } from "./preview/preview-panel";
import { Timeline } from "./timeline/timeline";
import { Inspector } from "./inspector/inspector";
import { FootagePanel } from "./states/footage-panel";
import { PlanStage } from "./states/plan-stage";
import { BuildingStage } from "./states/building-stage";
import { ExportDialog } from "./export/export-dialog";
import { ExportPanel } from "./export/export-panel";
import { useEditorKeyboard } from "./use-keyboard";

const ACTIVE_STATUSES = new Set(["ANALYZING", "PLANNING", "BUILDING"]);

export function Editor({ projectId, initial }: { projectId: string; initial: ProjectView }) {
  const init = useEditor((s) => s.init);
  const syncProject = useEditor((s) => s.syncProject);
  const setMessages = useEditor((s) => s.setMessages);
  const project = useEditor((s) => s.project);
  const script = useEditor((s) => s.script);
  const storeProjectId = useEditor((s) => s.projectId);

  // Initialise synchronously on first render so children see the script immediately.
  if (storeProjectId !== projectId) init(projectId, initial);
  React.useEffect(() => init(projectId, initial), [projectId, initial, init]);

  const view = project ?? initial;
  const activeJob = view.jobs.some((j) => j.status === "RUNNING" || j.status === "QUEUED");
  const pollFast = ACTIVE_STATUSES.has(view.status) || activeJob || (view.status === "EXPORTING" && activeJob);

  useSWR<ProjectView>(`/api/projects/${projectId}`, fetcher, {
    fallbackData: initial,
    refreshInterval: pollFast ? 2000 : 15000,
    revalidateOnFocus: true,
    dedupingInterval: 1000,
    onSuccess: (data) => syncProject(data),
  });

  const messages = useEditor((s) => s.messages);
  const hasPendingMessage = messages.some((m) => m.status === "pending");
  const hasScript = !!(view.currentVersion || script);
  useSWR<{ messages: MessageView[] }>(hasScript ? `/api/projects/${projectId}/messages` : null, fetcher, {
    refreshInterval: hasPendingMessage ? 1500 : 10000,
    dedupingInterval: 500,
    onSuccess: (data) => {
      const before = useEditor.getState().messages;
      setMessages(data.messages);
      // an edit finished: pull the project right away so the new version appears
      const finished = data.messages.some((m) => m.status !== "pending" && before.find((b) => b.id === m.id)?.status === "pending");
      if (finished) void useEditor.getState().refreshProject();
    },
  });

  useEditorKeyboard();

  const chatOpen = useEditor((s) => s.chatOpen);
  const inspectorOpen = useEditor((s) => s.inspectorOpen);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const exportPanelOpen = useEditor((s) => s.exportPanelOpen);

  const stage = stageFor(view, hasScript);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-fg" data-stage={stage}>
      <TopBar stage={stage} />
      <div className="flex min-h-0 flex-1">
        <Panel open={chatOpen} axis="x" size={320} className="border-r border-border">
          <ChatPanel stage={stage} />
        </Panel>
        <div className="relative flex min-w-0 flex-1 flex-col">
          {stage === "footage" && <FootagePanel />}
          {stage === "plan" && <PlanStage />}
          {stage === "building" && <BuildingStage />}
          {stage === "editor" && (
            <>
              <PreviewPanel />
              <Panel open={timelineOpen} axis="y" size={236} className="border-t border-border">
                <Timeline />
              </Panel>
            </>
          )}
          <AnimatePresence>
            {exportPanelOpen && (
              <motion.div initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 24, opacity: 0 }} transition={{ duration: 0.18 }} className="absolute right-3 top-3 z-20 w-[380px] max-w-[calc(100%-24px)]">
                <ExportPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {stage === "editor" && (
          <Panel open={inspectorOpen} axis="x" size={300} className="border-l border-border">
            <Inspector />
          </Panel>
        )}
      </div>
      <ExportDialog />
      <Toaster />
    </div>
  );
}

export type Stage = "footage" | "plan" | "building" | "editor";

function stageFor(view: ProjectView, hasScript: boolean): Stage {
  switch (view.status) {
    case "DRAFTING":
    case "ANALYZING":
    case "PLANNING":
      return hasScript ? "editor" : "footage";
    case "PLAN_READY":
      return hasScript ? "editor" : "plan";
    case "BUILDING":
      return "building";
    case "FAILED":
      return hasScript ? "editor" : view.plan ? "plan" : "footage";
    case "READY":
    case "EXPORTING":
    default:
      return hasScript ? "editor" : view.plan ? "plan" : "footage";
  }
}
