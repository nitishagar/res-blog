---
title: Your Agent's Failure Mode Is a Verification Problem, Not a Model Problem
dek: Teams keep swapping models to fix flaky agents. The real bottleneck is that LLM outputs are probabilistic — and test suites assume they are not.
tags: [AI Agents, Testing, Evals, Reliability, Engineering]
cover: posts/covers/verification-not-model.jpg
---

# Your Agent's Failure Mode Is a Verification Problem, Not a Model Problem

*Teams keep swapping models to fix flaky agents. The real bottleneck is that LLM outputs are probabilistic — and your test suite assumes they aren't.*

---

A team ships an agent. It works in the demo. It works in staging. In production it returns the wrong answer 3% of the time, and nobody can agree on why. The conversation follows a familiar arc:

- "Bump it to the bigger model." (Costs 5x. Error rate drops to 2%.)
- "Add more few-shot examples." (Error rate drops to 1.5%, then plateaus.)
- "Tune the prompt." (Error rate oscillates between 1% and 4% depending on who last edited it.)
- "Maybe we need a different framework." (Replatform. Error rate unchanged.)

Here's what's actually happening: **you're treating a probabilistic system like a deterministic one, and your verification layer is too thin to tell you where the error is.** Every model swap is a guess because you have no instrumentation that separates *retrieval failure* from *reasoning failure* from *tool-call formatting failure* from *genuine model-capability ceiling*.

Until you fix verification, model selection is roulette. Let's build the layer that makes the diagnosis tractable.

## Why agents break differently

Conventional software fails in ways your test suite was designed for: a function returns the wrong type, a service throws, a boundary condition trips. You write a unit test, it fails deterministically, you fix it, it stays fixed.

LLM agents fail in four qualitatively different ways, and most teams only instrument the first:

1. **Format failures** — the model returned valid JSON but with the wrong schema, or a tool call with a misnamed argument. Cheap to detect, catastrophic when missed because the downstream parse crashes silently or, worse, succeeds on garbage.
2. **Grounding failures** — the agent cited a fact not in the retrieved context, hallucinated a function signature, or invented a customer record. The output is well-formed and wrong.
3. **Reasoning failures** — the agent had the right context and the right tools but took the wrong path: called the wrong tool, stopped early, looped, or misranked options.
4. **Capability ceilings** — the task genuinely exceeds the model's reasoning ability at any price tier you can afford.

The problem: **all four look identical in your logs.** A 3% error rate is four different diseases aggregated into one number. Swapping models is a blunt intervention that moves all four dials at once and tells you nothing about which one dominated.

## The verification harness that actually diagnoses

The fix is a three-tier verification harness, run on every agent run in production and on every eval case offline. Each tier catches a different failure class, and each has a budget so you're not LLM-judging every trivial call.

**Tier 1 — Deterministic checks (free, catches format + schema failures).**

```python
def tier1_check(agent_output, expected_schema):
    # Schema validation
    if not validate_schema(agent_output, expected_schema):
        return fail("SCHEMA_VIOLATION", agent_output)
    # Tool-call argument checks against an allowlist
    for call in agent_output.tool_calls:
        if call.name not in TOOL_ALLOWLIST:
            return fail("UNKNOWN_TOOL", call)
        if missing_required_args(call):
            return fail("MISSING_ARG", call)
    # Regex / type guards on structured fields
    if not re.match(ISO8601, agent_output.payload["timestamp"]):
        return fail("BAD_TIMESTAMP", agent_output.payload["timestamp"])
    return ok()
```

This tier is pure code, runs in microseconds, and catches the silent-failure class that *“Your MCP tool isn’t broken. Your description is”* was about — the agent returned something your system accepted but shouldn’t have. Most teams skip it because “the model is good at JSON now.” It is, until it isn’t, and you won’t know.

**Tier 2 — LLM-as-judge (cheap, catches grounding + reasoning failures).**

Run a smaller, faster model (Haiku-tier) to grade the run on a rubric, but only on the slice that passed Tier 1 and only where deterministic checks can’t reach.

```python
def tier2_check(agent_output, retrieved_context, query):
    rubric = f"""
    Given the query and the retrieved context, judge the agent's answer.
    Fail if:
    - The answer cites a fact NOT present in retrieved_context (grounding).
    - The answer contradicts itself across steps (reasoning).
    - A more direct tool path was obviously available (efficiency).
    Return: {{pass: bool, failure_type: str, evidence: str}}
    """
    return haiku_judge(rubric, query, retrieved_context, agent_output)
```

The discipline here is **don’t judge everything.** Tier 2 is the most expensive tier per call. Gate it: only run the judge on outputs flagged as risky by Tier 1 heuristics (high entropy in the tool-call distribution, low retrieval confidence, long chain-of-thought with no tool use), or on a sampled 5% of traffic for calibration. Cost stays bounded; signal stays high.

**Tier 3 — Human-in-loop (expensive, catches capability ceilings + calibrates the judge).**

Route to a human reviewer:
- Any case where Tier 1 and Tier 2 *disagree* (Tier 1 passed but Tier 2 failed, or vice versa).
- Any case the user explicitly flagged (thumbs-down, retry, escalates to support).
- A random 0.5% sample, to detect drift in the judge itself.

The human-labeled cases become next month’s eval set. **This is the feedback loop most teams never close** — production failures get triaged to a bug tracker, fixed ad hoc, and the learnings never make it back into the regression suite. Tier 3 is how you compound.

## The diagnosis matrix

Once the harness is running, your “3% error rate” decomposes into something actionable:

| Failure type | Where it’s caught | What it actually means | The fix that works |
|---|---|---|---|
| SCHEMA_VIOLATION | Tier 1 | Output contract is ambiguous or unenforced | Tighten schema + structured outputs / function-calling mode |
| GROUNDING | Tier 2 | Retrieved context is wrong or missing | Fix retrieval, not the model (see BM25 piece) |
| REASONING | Tier 2 | Agent picked a bad path with good inputs | Add a planning step or better tool descriptions |
| CAPABILITY | Tier 3 (pattern) | Fails consistently even with perfect inputs | *Now* consider a bigger model, with evidence |

Notice the inversion: **model upgrade is the last column, not the first.** Most teams reach for it first because they have no instrumentation telling them the failure is actually in retrieval, or in the tool description, or in the schema. They pay frontier-model prices to compensate for a missing regex.

## The budget gate that keeps this real

Verification without a budget becomes a tax that nobody wants to pay. Set it explicitly:

- **Tier 1:** 100% of runs. Cost: negligible (CPU only).
- **Tier 2:** ≤10% of runs, gated by risk heuristics. Cost: one Haiku-tier call per judged run — single-digit cents.
- **Tier 3:** ≤1% of runs. Cost: human minutes; this is your eval-set factory, not a runtime cost center.

Total verification overhead should land around 2–5% of your inference spend. If it’s higher, your risk-gating heuristics are too loose. If it’s lower, you’re flying blind. The point isn’t to verify everything — it’s to verify the *right* things, cheaply, with a closed feedback loop.

## What changes Monday morning

1. **Instrument Tier 1 first, this week.** Schema + tool-arg validation on every agent run. This alone will surface a class of failures you currently blame on the model.
2. **Tag every production failure with its tier and type.** Within two weeks you’ll have a real distribution: how much of your error rate is grounding vs reasoning vs capability. You almost certainly have the proportions wrong today.
3. **Route Tier 3 samples into your eval set.** Close the loop. Production becomes your highest-quality source of regression tests.
4. **Re-open the model-swap decision with data.** If 70% of your failures are GROUNDING, no model upgrade will fix them — fix retrieval. If 70% are CAPABILITY, now the bigger model earns its margin.

## The through-line

This is the same lesson the reproducibility piece was about, scaled up to agents: **deterministic code and probabilistic systems need different verification strategies, and bolting the wrong one onto the other is where the silent failures live.** Agents don’t fail because the model is bad. They fail because the model is *probabilistic* and the surrounding system was designed as if it weren’t.

Stop swapping models to fix problems you haven’t diagnosed. Build the harness, decompose the error, and let the data tell you whether you need a bigger brain or a better guardrail. Nine times out of ten it’s the guardrail.

---

*Footnote on sources: Failure-mode patterns described here are consistent with active research on verification reliability — notably recent work on verification pitfalls in speculative decoding (lossy verification silently degrading output quality) and reliability-memory mechanisms for multi-agent systems. The three-tier harness and budget-gating approach reflects established practice from production LLM-ops and evaluation engineering; adapt the exact percentages to your error distribution and cost model.*
