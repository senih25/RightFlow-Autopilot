export type RightFlowFact = {
  key: "age" | "household_size" | "monthly_income" | "disability_report";
  label: string;
  value: number | boolean;
  confidence: "high" | "medium";
};

export type RightFlowEvent = {
  id: string;
  stage: "intake" | "qwen" | "guardrail" | "tool" | "approval" | "result";
  title: string;
  detail: string;
  status: "complete" | "waiting";
};

export type RightFlowCase = {
  caseId: string;
  mode: "QWEN_CLOUD" | "DETERMINISTIC_DEMO";
  model: string;
  facts: RightFlowFact[];
  missingFacts: string[];
  requiresApproval: true;
  events: RightFlowEvent[];
  assessment: {
    status: "READY_FOR_REVIEW" | "NEEDS_INFORMATION";
    summary: string;
    nextSteps: string[];
  };
};

export type RightFlowProgramScreening = {
  program: "OLD_AGE_SUPPORT" | "HOME_CARE_SUPPORT" | "GSS_INCOME_REVIEW";
  title: string;
  status: "POTENTIAL_MATCH" | "NEEDS_INFORMATION";
  reason: string;
  missingInformation: string[];
  nextStep: string;
};

export type RightFlowApprovedCase = {
  caseId: string;
  status: "HUMAN_APPROVED";
  disclaimer: string;
  screenings: RightFlowProgramScreening[];
  events: RightFlowEvent[];
};

const MAX_NARRATIVE_LENGTH = 2_000;
const injectionSignals = [
  /ignore (?:all|any|the) previous/iu,
  /system prompt/iu,
  /reveal (?:your|the) (?:secret|key|prompt)/iu,
  /developer message/iu,
];

export function normalizeNarrative(value: unknown): string {
  if (typeof value !== "string") throw new Error("Narrative must be text");
  const normalized = value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  if (normalized.length < 20 || normalized.length > MAX_NARRATIVE_LENGTH) {
    throw new Error("Narrative must contain 20 to 2000 characters");
  }
  return normalized;
}

export function containsPromptInjection(value: string): boolean {
  return injectionSignals.some((pattern) => pattern.test(value));
}

function numberFrom(value: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      const parsed = Number(match[1].replace(/[.,](?=\d{3}\b)/gu, ""));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

export function extractDeterministicFacts(narrative: string): RightFlowFact[] {
  const facts: RightFlowFact[] = [];
  const age = numberFrom(narrative, [/(\d{1,3})\s*yaş/iu, /(\d{1,3})\s*years?\s+old/iu, /age\s*(?:is|:)\s*(\d{1,3})/iu]);
  const household = numberFrom(narrative, [/(\d{1,2})\s*kiş/iu, /(\d{1,2})\s*people/iu, /household\s*(?:of|:)\s*(\d{1,2})/iu]);
  const income = numberFrom(narrative, [/(\d[\d.,]{2,})\s*(?:tl|₺)/iu, /income\s*(?:is|:)\s*(\d[\d.,]{2,})/iu]);

  if (age !== null && age <= 120) facts.push({ key: "age", label: "Age", value: age, confidence: "high" });
  if (household !== null && household <= 30) facts.push({ key: "household_size", label: "Household size", value: household, confidence: "high" });
  if (income !== null) facts.push({ key: "monthly_income", label: "Monthly household income", value: income, confidence: "medium" });
  if (/engelli raporu|disability report/iu.test(narrative)) {
    facts.push({ key: "disability_report", label: "Disability report mentioned", value: true, confidence: "medium" });
  }
  return facts;
}

export function missingRequiredFacts(facts: RightFlowFact[]): string[] {
  const present = new Set(facts.map((fact) => fact.key));
  return [
    ["age", "Age of the person seeking support"],
    ["household_size", "Number of people in the household"],
    ["monthly_income", "Total monthly household income"],
  ].filter(([key]) => !present.has(key as RightFlowFact["key"])).map(([, label]) => label);
}

export function buildRightFlowCase(
  narrative: string,
  options: { qwenFacts?: RightFlowFact[]; model?: string } = {},
): RightFlowCase {
  const facts = options.qwenFacts?.length ? options.qwenFacts : extractDeterministicFacts(narrative);
  const missingFacts = missingRequiredFacts(facts);
  const mode = options.qwenFacts?.length ? "QWEN_CLOUD" : "DETERMINISTIC_DEMO";
  const safeInput = !containsPromptInjection(narrative);
  const events: RightFlowEvent[] = [
    { id: "intake", stage: "intake", title: "Narrative accepted", detail: "Input minimized and normalized; raw text is not persisted.", status: "complete" },
    { id: "qwen", stage: "qwen", title: mode === "QWEN_CLOUD" ? "Qwen extracted case facts" : "Safe demo extractor used", detail: `${facts.length} structured facts produced with a strict allowlist.`, status: "complete" },
    { id: "guardrail", stage: "guardrail", title: "Safety policy evaluated", detail: safeInput ? "No instruction-conflict signal detected." : "Instruction-conflict text was treated as untrusted case content.", status: "complete" },
    { id: "approval", stage: "approval", title: "Human verification required", detail: "A person must confirm extracted facts before any eligibility tool can run.", status: "waiting" },
  ];
  return {
    caseId: `rf_${crypto.randomUUID()}`,
    mode,
    model: options.model ?? "deterministic-demo-v1",
    facts,
    missingFacts,
    requiresApproval: true,
    events,
    assessment: {
      status: missingFacts.length ? "NEEDS_INFORMATION" : "READY_FOR_REVIEW",
      summary: missingFacts.length
        ? "The case is paused until the missing facts are confirmed."
        : "The structured case is ready for human review and deterministic assessment.",
      nextSteps: missingFacts.length
        ? missingFacts.map((fact) => `Confirm: ${fact}`)
        : ["Review the extracted facts", "Approve the deterministic eligibility check", "Inspect the rule trace and verified sources"],
    },
  };
}

function readFact<T extends number | boolean>(facts: RightFlowFact[], key: RightFlowFact["key"]): T | null {
  const fact = facts.find((item) => item.key === key);
  return (fact?.value as T | undefined) ?? null;
}

export function approveAndScreenRightFlowCase(caseId: unknown, facts: unknown): RightFlowApprovedCase {
  if (typeof caseId !== "string" || !/^rf_[0-9a-f-]{36}$/u.test(caseId)) {
    throw new Error("Invalid case identifier");
  }
  if (!Array.isArray(facts) || facts.length === 0 || facts.length > 8) {
    throw new Error("Invalid case facts");
  }
  const allowedKeys = new Set<RightFlowFact["key"]>(["age", "household_size", "monthly_income", "disability_report"]);
  const validatedFacts: RightFlowFact[] = facts.map((value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid case fact");
    const fact = value as RightFlowFact;
    if (!allowedKeys.has(fact.key) || typeof fact.label !== "string" || fact.label.length > 80) throw new Error("Invalid case fact");
    if (typeof fact.value !== "number" && typeof fact.value !== "boolean") throw new Error("Invalid case fact");
    if (fact.confidence !== "high" && fact.confidence !== "medium") throw new Error("Invalid case fact");
    return { ...fact };
  });
  if (new Set(validatedFacts.map((fact) => fact.key)).size !== validatedFacts.length) {
    throw new Error("Duplicate case fact");
  }

  const age = readFact<number>(validatedFacts, "age");
  const householdSize = readFact<number>(validatedFacts, "household_size");
  const monthlyIncome = readFact<number>(validatedFacts, "monthly_income");
  const disabilityReport = readFact<boolean>(validatedFacts, "disability_report");
  const perCapitaIncome = householdSize && monthlyIncome !== null ? monthlyIncome / householdSize : null;

  const screenings: RightFlowProgramScreening[] = [
    {
      program: "OLD_AGE_SUPPORT",
      title: "Older-person support review",
      status: age !== null && age >= 65 ? "POTENTIAL_MATCH" : "NEEDS_INFORMATION",
      reason: age !== null && age >= 65
        ? "The confirmed age meets the basic age signal for an older-person support review."
        : "The age signal is missing or below the program's initial review boundary.",
      missingInformation: ["Personal income", "Spouse income, if applicable", "Social-security or pension status", "Citizenship and residence"],
      nextStep: "Complete the dedicated 65+ preliminary assessment with the missing facts.",
    },
    {
      program: "HOME_CARE_SUPPORT",
      title: "Home-care support review",
      status: disabilityReport === true ? "POTENTIAL_MATCH" : "NEEDS_INFORMATION",
      reason: disabilityReport === true
        ? "A disability report was confirmed, so a home-care support review may be relevant."
        : "A disability report has not been confirmed.",
      missingInformation: ["Disability report rate", "Full-dependency or care-need status", "Household income evidence", "Caregiver relationship"],
      nextStep: "Verify the medical report and care-dependency conditions before assessment.",
    },
    {
      program: "GSS_INCOME_REVIEW",
      title: "GSS income review",
      status: perCapitaIncome !== null ? "POTENTIAL_MATCH" : "NEEDS_INFORMATION",
      reason: perCapitaIncome !== null
        ? `The confirmed facts produce a monthly per-capita income of ${Math.round(perCapitaIncome).toLocaleString("en-US")} TRY for review.`
        : "Household size or total monthly income is missing.",
      missingInformation: ["Active insurance status", "Current official income threshold", "Additional household income and assets"],
      nextStep: "Run the versioned GSS income assessment against the current official threshold.",
    },
  ];

  return {
    caseId,
    status: "HUMAN_APPROVED",
    disclaimer: "This is a preliminary program screening, not an official eligibility decision or benefit guarantee.",
    screenings,
    events: [
      { id: "approval-complete", stage: "approval", title: "Facts approved by a human", detail: "The reviewed facts were released to the deterministic screening tool.", status: "complete" },
      { id: "tool", stage: "tool", title: "Program screening completed", detail: "Three bounded social-rights pathways were checked without issuing an official eligibility decision.", status: "complete" },
      { id: "result", stage: "result", title: "Action plan prepared", detail: "Missing information and the safest next step were generated for each relevant program.", status: "complete" },
    ],
  };
}
