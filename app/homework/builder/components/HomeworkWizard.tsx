"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createHomeworkSet,
  publishHomework,
  saveHomeworkDraft,
  type CreateHomeworkPayload,
  type SaveHomeworkDraftPayload,
} from "@/app/homework/services/homeworkService";
import type { HomeworkDraftState, WizardControllerState, WizardStepId } from "./wizard/types";
import { createInitialDraft } from "./wizard/defaults";
import { Stepper } from "./wizard/Stepper";
import { MetadataStep } from "./wizard/MetadataStep";
import { DatasetStep } from "./wizard/DatasetStep";
import { QuestionsStep } from "./wizard/QuestionsStep";
import { RubricStep } from "./wizard/RubricStep";
import { PublishStep } from "./wizard/PublishStep";
import type { Question } from "@/app/homework/types";
import { useHomeworkLocale } from "@/app/homework/context/HomeworkLocaleProvider";

const stepConfig: Array<{ id: WizardStepId; labelKey: string }> = [
  { id: "metadata", labelKey: "builder.wizard.step.metadata" },
  { id: "dataset", labelKey: "builder.wizard.step.dataset" },
  { id: "questions", labelKey: "builder.wizard.step.questions" },
  { id: "rubric", labelKey: "builder.wizard.step.rubric" },
  { id: "publish", labelKey: "builder.wizard.step.publish" },
];

function parseSchema(input: string): Array<{ column: string; type: string }> {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => Boolean(item?.column && item?.type));
    }
  } catch (error) {
    console.warn("Invalid schema JSON", error);
  }
  return [];
}

function buildQuestionsPayload(draft: HomeworkDraftState): Question[] {
  return draft.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    instructions: question.instructions,
    starterSql: question.starterSql,
    expectedResultSchema: parseSchema(question.expectedResultSchema),
    gradingRubric: question.rubric,
    datasetId: question.datasetId ?? draft.dataset.selectedDatasetId,
    maxAttempts: question.maxAttempts,
    points: question.points,
    evaluationMode: question.evaluationMode,
  }));
}

function buildDraftPayload(draft: HomeworkDraftState): SaveHomeworkDraftPayload {
  return {
    title: draft.metadata.title,
    courseId: draft.metadata.courseId,
    dueAt: draft.metadata.dueAt,
    visibility: draft.metadata.visibility,
    datasetPolicy: draft.metadata.datasetPolicy,
    questionOrder: draft.questions.map((question) => question.id),
    questions: buildQuestionsPayload(draft),
  };
}

function buildCreatePayload(draft: HomeworkDraftState): CreateHomeworkPayload {
  const base = buildDraftPayload(draft);
  return {
    ...base,
    published: draft.metadata.visibility === "published",
  };
}

interface HomeworkWizardProps {
  initialState?: HomeworkDraftState;
  existingSetId?: string;
  initialStep?: WizardStepId;
}

export function HomeworkWizard({ initialState, existingSetId, initialStep = "metadata" }: HomeworkWizardProps) {
  const router = useRouter();
  const { t, direction } = useHomeworkLocale();
  const backArrow = direction === "rtl" ? "→" : "←";
  const initialDraft = useMemo(() => initialState ?? createInitialDraft(), [initialState]);
  const [controller, setController] = useState<WizardControllerState>({
    step: initialStep,
    draft: initialDraft,
    setId: existingSetId,
  });
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedHash, setLastSavedHash] = useState<string | null>(() =>
    initialState ? JSON.stringify(buildDraftPayload(initialDraft)) : null,
  );

  useEffect(() => {
    if (existingSetId) {
      setController((prev) => ({ ...prev, setId: existingSetId }));
    }
  }, [existingSetId]);

  useEffect(() => {
    if (!initialState) return;
    setController({ step: initialStep, draft: initialState, setId: existingSetId });
    setLastSavedHash(JSON.stringify(buildDraftPayload(initialState)));
  }, [initialState, existingSetId, initialStep]);

  const localizedSteps = useMemo(
    () => stepConfig.map((step) => ({ id: step.id, label: t(step.labelKey) })),
    [t],
  );

  const currentStepIndex = useMemo(
    () => stepConfig.findIndex((step) => step.id === controller.step),
    [controller.step],
  );

  const canNavigateBack = currentStepIndex > 0;

  const createSetMutation = useMutation({
    mutationFn: (payload: CreateHomeworkPayload) => createHomeworkSet(payload),
    onSuccess: (set) => {
      setController((prev) => ({ ...prev, setId: set.id }));
      setAutoSaveState("saved");
      setLastSavedHash(JSON.stringify(buildDraftPayload(controller.draft)));
    },
    onError: (error) => {
      console.error("Failed to create homework set", error);
      setAutoSaveState("error");
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: ({ setId, payload }: { setId: string; payload: SaveHomeworkDraftPayload }) =>
      saveHomeworkDraft(setId, payload),
    onSuccess: (_, variables) => {
      setAutoSaveState("saved");
      setLastSavedHash(JSON.stringify(variables.payload));
    },
    onError: (error) => {
      console.error("Failed to save draft", error);
      setAutoSaveState("error");
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ setId, published }: { setId: string; published: boolean }) => publishHomework(setId, published),
    onSuccess: (_, variables) => {
      router.push(`/homework/builder/${variables.setId}/preview`);
    },
    onError: (error) => {
      console.error("Failed to publish homework", error);
    },
  });

  useEffect(() => {
    if (!controller.setId) return;
    const payload = buildDraftPayload(controller.draft);
    const nextHash = JSON.stringify(payload);
    if (nextHash === lastSavedHash) return;

    const timer = window.setTimeout(() => {
      setAutoSaveState("saving");
      saveDraftMutation.mutate({ setId: controller.setId!, payload });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [controller.setId, controller.draft, lastSavedHash, saveDraftMutation]);

  const disabledSteps = useMemo<WizardStepId[]>(() => {
    if (!controller.setId) {
      return ["dataset", "questions", "rubric", "publish"];
    }
    return [];
  }, [controller.setId]);

  const navigateToStep = (stepId: WizardStepId) => {
    setController((prev) => ({ ...prev, step: stepId }));
  };

  const updateDraft = (updater: (draft: HomeworkDraftState) => HomeworkDraftState) => {
    setController((prev) => ({
      ...prev,
      draft: updater(prev.draft),
    }));
  };

  const handleMetadataChange = (metadata: HomeworkDraftState["metadata"]) => {
    updateDraft((draft) => ({ ...draft, metadata }));
  };

  const handleDatasetChange = (dataset: HomeworkDraftState["dataset"]) => {
    updateDraft((draft) => ({ ...draft, dataset }));
  };

  const handleQuestionsChange = (questions: HomeworkDraftState["questions"]) => {
    updateDraft((draft) => ({ ...draft, questions }));
  };

  const handleMetadataContinue = async (nextStep: WizardStepId) => {
    if (!controller.setId) {
      const payload = buildCreatePayload(controller.draft);
      await createSetMutation.mutateAsync(payload);
    }
    navigateToStep(nextStep);
  };

  const handlePublish = async () => {
    if (!controller.setId) return;
    await publishMutation.mutateAsync({ setId: controller.setId, published: true });
  };

  const publishDisabled = publishMutation.isPending || !controller.setId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} dir={direction}>
      <Stepper
        steps={localizedSteps}
        activeStep={controller.step}
        onStepClick={(step) => !disabledSteps.includes(step) && navigateToStep(step)}
        disabledSteps={disabledSteps}
      />

      {controller.step === "metadata" && (
        <MetadataStep
          value={controller.draft.metadata}
          onChange={handleMetadataChange}
          onNext={handleMetadataContinue}
          isInitializing={createSetMutation.isPending}
        />
      )}

      {controller.step === "dataset" && (
        <DatasetStep
          value={controller.draft.dataset}
          onChange={handleDatasetChange}
          onBack={navigateToStep}
          onNext={navigateToStep}
          allowCustomDatasets={controller.draft.metadata.datasetPolicy === "custom"}
        />
      )}

      {controller.step === "questions" && (
        <QuestionsStep
          questions={controller.draft.questions}
          onChange={handleQuestionsChange}
          onBack={navigateToStep}
          onNext={navigateToStep}
          primaryDatasetId={controller.draft.dataset.selectedDatasetId}
        />
      )}

      {controller.step === "rubric" && (
        <RubricStep
          questions={controller.draft.questions}
          onChange={handleQuestionsChange}
          onBack={navigateToStep}
          onNext={navigateToStep}
        />
      )}

      {controller.step === "publish" && (
        <PublishStep
          metadata={controller.draft.metadata}
          dataset={controller.draft.dataset}
          questions={controller.draft.questions}
          onBack={navigateToStep}
          onPublish={handlePublish}
          publishDisabled={publishDisabled}
          setId={controller.setId}
          autoSaveState={autoSaveState}
          onRefresh={() => {
            if (!controller.setId) return;
            const payload = buildDraftPayload(controller.draft);
            setAutoSaveState("saving");
            saveDraftMutation.mutate({ setId: controller.setId, payload });
          }}
        />
      )}

      {canNavigateBack && controller.step !== "metadata" && (
        <button
          type="button"
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#2e83e6", cursor: "pointer" }}
          onClick={() => navigateToStep(stepConfig[currentStepIndex - 1]?.id ?? "metadata")}
        >
          {backArrow} {t("builder.wizard.back")}
        </button>
      )}
    </div>
  );
}
