---
title: Your Repo Was Built for Humans. Your Agents Are the Users Now.
dek: Anthropic just replaced Git because its agents merge 30,000 changes a day. You should not replace Git. But the pressure that forced their hand is already in your repo — here is where it shows up first.
tags: [Software Engineering, Git, DevOps, AI, Programming]
cover: posts/covers/your-repo-was-built-for-humans.jpg
---

# Your Repo Was Built for Humans. Your Agents Are the Users Now.

*Anthropic just replaced Git because its agents merge 30,000 changes a day. You should not replace Git. But the pressure that forced their hand is already in your repo — it's just wearing smaller numbers. Here's where it shows up first, and what to fix in the Git you already have.*

---

## First, an honest sentence: do not build a version control system

On October 13, Anthropic published the most interesting infrastructure post of the year. In May 2026 they merged about **2,500 code changes a day**. By September: **over 30,000 a day** — a twelvefold jump in four months, driven, in their words, by Claude writing code, reviewing code, and iterating on research loops on its own. Source control became, quote, "our biggest development bottleneck."

So a team of seven built **Scion**, a new version control system, plus a code-review tool called Antique, code search, and a source-control IAM system — and migrated the whole monorepo off Git in five months.

The internet filed this under "Git is dead." It isn't — Anthropic says so themselves: *"Scion is by no means a suitable replacement for git for general use."* Their workload is an outlier's outlier: main-branch history **almost 100 GB**, a compressed working copy over **25 GB**, on the order of **25 million checkouts a day** for CI alone (naively fetched, **over 600 petabytes a day**), *several hundred* internal Git mirrors at peak. Perhaps seven companies on Earth have this problem at this size. You are not one of them. Neither am I. So why write about Scion at all?

Because I read the post the way you read a weather report from a town upwind of yours. The storm that hits them at 30,000 merges a day arrives at your repo as a drizzle: agent PRs queuing behind a merge queue designed for humans, CI bills climbing for reasons nobody can itemise, checkouts that take minutes in jobs that run for seconds. **The bottleneck moved from writing code to absorbing code.** Last month I wrote about the human half of that sentence — six agents, one reviewer, a queue that collapsed by hour three. This is the machine half. Same storm, other window.

One line to take from this piece: **keep Git, and start operating it as if agents are its primary client — because in your repo, increasingly, they are.**

## What actually broke (it's not the part you'd guess)

Git's founding bargain is beautiful: every clone is a complete repository. Offline diffs, offline blame, offline history. For twenty years that bargain was obviously right, because the client was a human with a laptop and a plane to catch.

An agent is not that client. An agent — and its even more numerous cousins, CI jobs and sandboxes — is always online, lives for minutes, wants a thin slice of the repo *right now*, and will ask the same metadata questions ("who touched this file?", "what's the merge base?") millions of times a day. Forcing that client to negotiate packfiles and maintain a local repository to answer those questions is like making every API caller download the database.

Scion's design is what you get when you take the new client seriously:

- **Server-centric, content-addressed everything.** Changesets, trees, and blobs never change once stored, so any tier can cache them without asking anyone. Servers become, in Anthropic's phrase, essentially large caches that can also compute.
- **Derived data computed once, server-side.** Blame, path history, commit-graph indices — computed generically from changesets, eagerly or lazily, instead of re-derived by every clone forever.
- **Checkouts as cache reads.** The client asks only for the trees and blobs it actually wants, recursively — no multi-gigabyte packfile, resumable by construction, sparse for free because "sparse" just means "didn't ask." A per-node daemon shares objects across every job on the machine; regional caches stream from memory. Every tier reports a **cache hit rate over 99%**.

The results are the part to underline. Scion's infrastructure footprint is **200× smaller** in CPU and memory than the Git-mirroring fleet it replaced. Checkouts went from minutes to **seconds — two orders of magnitude** — and CI alone got a **25% CPU capacity win** back. Read that again slowly. A quarter of their CI fleet was, in effect, being spent *fetching code*.

Two caveats. Anthropic could do this partly because their internal token budget "far exceeds what any other business would realistically want to spend" — a seven-person, five-month VCS migration is agent leverage, not a photocopiable plan. And even they haven't solved everything: a proper merge queue "doesn't make much sense at agent scale," so weight shifted to post-merge and pre-deploy testing. That's why the small-scale lessons matter now, while your numbers are still forgiving.

## The five pressure points, in the order you'll meet them

You don't need Scion. You need to know which wall you're walking toward. In every repo where agents open PRs daily, the walls arrive in roughly this order.

**1. Checkout cost becomes a line item.** Humans clone once and amortise it for months. Agents and CI jobs are born, clone, work, and die — hundreds of times a day. If your checkout takes three minutes and your job runs for four, you don't have a CI cost problem, you have a *fetch* problem wearing a CI costume. The Git-native fixes are unglamorous and mostly already in your toolbox: shallow and blobless clones (`--filter=blob:none`), sparse checkouts scoped to the service under test, warm local mirrors or seed snapshots next to your runners, and worktree reuse for agent sandboxes instead of a fresh clone per thread. Measure "seconds spent fetching" as its own dashboard panel. Anthropic's 25% CI win is what lives behind that panel at scale.

**2. Merge throughput stops being free.** A merge queue is a lock, and queueing theory is merciless: as merges-per-hour approaches what your checks can clear per hour, wait time walks off a cliff (Little's Law: queue = arrival rate × time in system; every rebase-and-rerun feeds the queue its own tail). Boring fixes: smaller PRs (a 2,000-line agent PR is a batch-size bug), trunk-based flow, affected-only test selection, merge-queue batching where supported. I sized the *reviewer* to the farm in Post-6. Size the *merge path* the same way — it's deploy capacity.

**3. CI capacity becomes a budget conversation.** The routing-number lesson in a new costume: the honest unit is **cost per merged, surviving change** — fetch, post-rebase reruns, flaky retries, abandoned PRs included. Track monthly: checkouts/day, CI minutes per merged change, merge-queue wait (p50/p90). When all three climb together, spend on mirrors, caches, and test selection then — not when the queue hits four hours and someone suggests disabling required checks.

**4. Review needs semantics, not just eyes.** Antique, Anthropic's review tool, can "express complex semantic constraints on approvals" — a comment-only change and a sensitive logic change don't get the same gate. Approximate it today with path-based ownership, diff-size caps, and risk tiers (the T0–T3 table from my escalation-queue piece, pointed at merges). The strain is measurable: a 2026 working paper (700+ firms) found ~30% more code per developer, shipped output flat, review time per PR up ~49%. Generation scaled; absorption didn't. Tiering by consequence is how absorption catches up without a wall of rubber stamps.

**5. Agents need identities, not borrowed human ones.** Scion shipped per-directory permissions and rich IAM from day one because "who — or what — may write here?" is a security boundary. Starter version: distinct bot identity per agent system (never a shared human token), agent branches treated as untrusted input, CODEOWNERS paths agents can't self-approve, and an audit trail answering "which run produced this change?" If you can't answer that today, it's your first fix — it pays out the first time a confident agent refactor needs a 2 a.m. revert.

## What I actually changed in my own repos (the small-numbers version)

My most ambitious repo fits inside a rounding error of Anthropic's `main`. Reading Scion as a checklist, not a headline, still gave me a weekend's worth of plain-Git changes: agent runs now start from a warm shared mirror (`git worktree add` off a bare, cron-freshened clone — *fetch once per machine, not once per job*); agent PRs carry a diff-size budget the coordinator enforces by splitting; CI runs affected-only checks pre-merge with the full suite on trunk; and the dashboard tracks checkouts/day, CI minutes per *merged* change, and PR-open-to-merge time. No platform team required. Same lesson as always: the model got leverage first, and everything around it has to be re-plumbed for the new arrival rate.

## The checklist (tape it next to the merge queue)

Before your agents' third month in the repo:

1. **Fetch is a metric.** Seconds-per-checkout and checkouts/day on a dashboard. Shallow/blobless clones, sparse checkouts, warm mirrors beside the runners.
2. **Batch size is a policy.** Diff-size caps for agent PRs, enforced before human review. Split, don't queue.
3. **Checks scale with the change.** Affected-only tests pre-merge; full suite on trunk; flakes quarantined, never retried into submission.
4. **Cost per merged change.** Not per PR, not per run. Include fetch, reruns, and abandonments. Review it monthly like any unit cost.
5. **Review tiered by consequence.** Path-based ownership and approval shapes. Comment-only ≠ payment path. Humans read where consequence lives.
6. **Agents have names.** Per-system bot identities, no borrowed human tokens, no self-approval on owned paths, and a run ID in every PR body so "which agent did this?" is a query, not an investigation.

## Takeaway

Anthropic's post will be remembered as the week a lab replaced Git. Read it a second time and it's a different, quieter document: a field report from the first team to discover that developer infrastructure has a *client assumption* baked into every layer — and that the client changed. They end it generously, by the way: Scion isn't coming to you, so they're sharing the thinking "so that other developers can apply some of the most successful parts of Scion to git without departing from the overall model," and partnering with the GitHub, GitLab, and OSS communities to scale what exists. Bet on Git adapting. Plan for your repo to need the adaptation.

The storm metaphor holds to the end. You don't rebuild your house because a town upwind lost its roof. You check your own roof while the weather is still mild. Your agents became your repo's most frequent users some time this year — probably on a Tuesday, probably without a meeting about it.

**Now go look at your checkout times. I'll wait. It won't take as long as your CI does.**

---

### Sources

- Anthropic, [*Redesigning source control at Anthropic*](https://www.anthropic.com/engineering/redesigning-source-control) (Oct 13, 2026; updated Oct 15): 2,500 → 30,000+ merges/day (May→Sep 2026), ~100 GB main history, ~25M checkouts/day, >600 PB/day naive fetch, several hundred Git mirrors, Scion's content-addressed tiered-cache design (>99% hit per tier), 200× smaller footprint, checkouts in seconds, CI +25% CPU, 7-person team / 5-month migration, Antique semantic approvals, and the explicit "not a suitable replacement for git for general use"
- Secondary coverage, same week: [Hacker Noon timeline](https://hackernoon.com/ai-agents-are-killing-the-git-client-not-git-what-anthropics-scion-and-cursors-origin-show) (Scion alongside Cursor's Origin) · [EveryDev weekly digest](https://www.everydev.ai/p/news-weekly-ai-dev-news-digest-october-10-october-16-2026) (Oct 16, 2026) — re-check ecosystem responses on publication day; details are days old
- 718-firm working paper on AI coding agents (v1 Jan 2026; Aug 2026 revision): ~30% more code per developer, shipped output flat, review time +49%, revisions nearly doubled — via [AIWeekly](https://aiweekly.co/alerts/harvard-study-ai-coding-agents-lift-code-30-shipped-output-flat) (Oct 2026); treat as working-paper evidence, not settled fact
- Git itself: [partial clone](https://git-scm.com/docs/partial-clone), [sparse checkout](https://git-scm.com/docs/git-sparse-checkout), [worktrees](https://git-scm.com/docs/git-worktree) — the in-Git mitigations listed above

**Earlier in this series:**

- *I Pointed Six Agents at Our Repo. The Bottleneck Moved to Me.*: the human half of this story — verification bandwidth and review capacity
- *Ship the Escalation Queue Before You Ship the Agent*: the T0–T3 consequence tiers, applied here to merges
- *The Routing Number No One Measures*: cost-per-success — here, cost per merged, surviving change
- *Your Multi-Agent System Is a Distributed System in Denial*: why a merge queue is a lock, and locks have queueing theory

**Suggested Medium tags:** Software Engineering · Git · DevOps · AI · Programming

