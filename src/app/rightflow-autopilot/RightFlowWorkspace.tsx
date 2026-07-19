"use client";

import { useState } from "react";
import type { RightFlowApprovedCase, RightFlowCase } from "@/lib/rightflow";

const demoNarrative =
  "My mother is 68 years old and lives with me. We are a household of 3 with a total monthly income of 28,500 TL. She has a disability report, but we do not know which social supports to review.";

export function RightFlowWorkspace() {
  const [narrative, setNarrative] = useState(demoNarrative);
  const [result, setResult] = useState<RightFlowCase | null>(null);
  const [approvedResult, setApprovedResult] = useState<RightFlowApprovedCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeCase() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rightflow/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative }),
      });
      const payload = (await response.json()) as RightFlowCase | { error?: string };
      if (!response.ok || !("caseId" in payload)) {
        const message = "error" in payload ? payload.error : undefined;
        throw new Error(message ?? "The case could not be analyzed.");
      }
      setResult(payload);
      setApprovedResult(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The case could not be analyzed.");
    } finally {
      setLoading(false);
    }
  }

  async function approveCase() {
    if (!result) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/rightflow/cases/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: result.caseId, facts: result.facts }),
      });
      const payload = (await response.json()) as RightFlowApprovedCase | { error?: string };
      if (!response.ok || !("screenings" in payload)) {
        const message = "error" in payload ? payload.error : undefined;
        throw new Error(message ?? "The approved case could not be screened.");
      }
      setApprovedResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The approved case could not be screened.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="panel-strong">
        <p className="eyebrow">Case intake</p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">Describe the situation naturally</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          RightFlow extracts only explicit facts. It does not let the language model make a legal or eligibility decision.
        </p>
        <label className="form-field mt-6">
          Citizen narrative
          <textarea
            rows={9}
            maxLength={2000}
            value={narrative}
            onChange={(event) => setNarrative(event.target.value)}
          />
        </label>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="primary-button" type="button" disabled={loading} onClick={analyzeCase}>
            {loading ? "Orchestrating…" : "Start safe orchestration"}
          </button>
          <span className="status-pill">No raw narrative persistence</span>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</p> : null}
      </section>

      <section className="panel-strong" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Human checkpoint</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Review before assessment</h2>
          </div>
          <span className="status-pill">{result?.mode ?? "Waiting"}</span>
        </div>
        {!result ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
            The structured facts and execution trace will appear here.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {result.facts.map((fact) => (
                <div className="rounded-2xl border border-slate-200 bg-white p-4" key={fact.key}>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{fact.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">{String(fact.value)}</p>
                  <p className="mt-1 text-xs text-teal-700">{fact.confidence} confidence</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-semibold text-amber-950">Approval gate active</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">{result.assessment.summary}</p>
            </div>
            <button className="primary-button w-full" type="button" disabled={loading || Boolean(approvedResult)} onClick={approveCase}>
              {approvedResult ? "Facts approved and screened" : loading ? "Running bounded tools…" : "Approve facts and screen programs"}
            </button>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Next safe steps</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {result.assessment.nextSteps.map((step) => <li className="rounded-xl bg-slate-50 p-3" key={step}>{step}</li>)}
              </ul>
            </div>
          </div>
        )}
      </section>

      {approvedResult ? (
        <section className="panel-strong lg:col-span-2" aria-labelledby="screening-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Deterministic program screening</p>
              <h2 id="screening-heading" className="mt-3 text-3xl font-semibold text-slate-950">Relevant support pathways</h2>
            </div>
            <span className="status-pill">Human approved</span>
          </div>
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{approvedResult.disclaimer}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {approvedResult.screenings.map((screening) => (
              <article className="rounded-3xl border border-slate-200 bg-white p-5" key={screening.program}>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700">{screening.status.replaceAll("_", " ")}</span>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">{screening.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">{screening.reason}</p>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Information still required</p>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {screening.missingInformation.map((item) => <li key={item}>• {item}</li>)}
                </ul>
                <p className="mt-5 rounded-2xl bg-teal-50 p-3 text-sm font-medium leading-6 text-teal-950">{screening.nextStep}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel-strong lg:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Explainable execution</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">Agent audit timeline</h2>
          </div>
          {result ? <code className="rounded-xl bg-slate-950 px-3 py-2 text-xs text-teal-200">{result.caseId}</code> : null}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {([...(result?.events ?? []), ...(approvedResult?.events ?? [])]).map((event) => (
            <article className="rounded-2xl border border-slate-200 bg-white p-4" key={event.id}>
              <span className={event.status === "complete" ? "text-teal-700" : "text-amber-700"}>● {event.status}</span>
              <h3 className="mt-3 font-semibold text-slate-950">{event.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{event.detail}</p>
            </article>
          ))}
          {!result ? <p className="text-slate-500">Run the demo to generate a trace.</p> : null}
        </div>
      </section>
    </div>
  );
}
