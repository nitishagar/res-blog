---
title: BM25 Is Eating Your Vector DB (And It Should)
dek: A scaling study just said the boring algorithm wins. Here is when to believe it — and the 20-line baseline to test your own retriever.
tags: [AI, Search, RAG, Engineering, Databases]
cover: posts/covers/bm25-is-eating-your-vector-db.jpg
---

# BM25 Is Eating Your Vector DB (And It Should)

*A scaling study just said the boring algorithm wins. Here's when to believe it — and the 20-line baseline to test your own retriever.*

---

A scaling study on retrieval-augmented generation (RAG) paradigms is making the rounds, and its headline lands like a thunk: **at scale, plain BM25 beats the dense and hybrid retrievers people pay a premium for.** Not "is competitive with." Beats.

If you've spent the last two years wiring embeddings into Pinecone, pgvector, or a managed retrieval API, that sentence should sting a little. Not because dense retrieval is useless — it isn't — but because the default RAG architecture has been "vector DB first, everything else later" for so long that nobody remembers why.

Let's dig into when BM25 actually wins, when it doesn't, and the cheap experiment that tells you which side you're on.

## The default you didn't choose

Here's the RAG stack most teams ship today:

1. Chunk your corpus.
2. Embed every chunk with a sentence-transformer or a frontier-model endpoint.
3. Stuff the vectors into a vector database.
4. At query time, embed the question, run ANN search, feed top-k into the LLM.

It works. It's also expensive, fragile, and — for a large class of workloads — slower at finding the right document than an algorithm from 1994.

BM25 is the ranking function behind Elasticsearch, OpenSearch, Lucene, and Postgres full-text search. It scores documents by term frequency, inverse document frequency, and document length normalization. No embeddings. No GPU. No model to fine-tune when your domain shifts. It's the `grep` of search: boring, fast, and surprisingly hard to beat on the things people actually search for.

## Why BM25 keeps winning the boring fights

The reason isn't mystical. It's three mechanical facts:

**1. Queries are already keywords.** When a user types `kafka consumer group rebalance error`, the discriminative signal is in those exact tokens. Dense retrieval maps that query into a 1024-dim vector where the distinction between "rebalance" and "reboot" can get smeared. BM25 just looks for the word. For technical, entity-heavy, and code-adjacent corpora — API docs, runbooks, logs, source — lexical match is the *ground truth* of relevance.

**2. Rare terms carry the signal.** BM25's IDF component upweights terms that appear in few documents. In a 10M-doc enterprise corpus, the error code `ORA-00942` appears in eleven documents. Dense similarity might rank all Oracle-flavored docs highly. BM25 puts the eleven right ones first because the rare token dominates the score.

**3. Zero model drift.** Your embedding model gets updated, your domain vocabulary shifts, you reindex. BM25 has no model. The same index that ranked well in 2023 ranks the same way in 2026. For long-lived systems, that's a feature, not a limitation.

## The part the study is actually telling us

The deeper finding from the scaling work isn't "BM25 good, vectors bad." It's that **retrieval quality curves cross as corpus size grows.** On small, clean, natural-language corpora, dense retrieval's semantic match genuinely helps — "how do I reset my password" finds a doc titled "credential recovery." On large, heterogeneous, domain-heavy corpora, that semantic softness becomes noise, and lexical precision wins.

This matches what production search teams have whispered for years: hybrid retrieval (BM25 + dense, fused with reciprocal rank fusion) is the *floor*, and on technical corpora the BM25 leg carries most of the weight. The expensive vector leg is often contributing a few points of nDCG for a 10x cost and latency premium.

The actionable version of the headline: **you may be paying vector-DB prices to retrieve documents that keyword search would find better.**

## A 20-line baseline that will save you a sprint

Before you defend your retriever architecture, measure it. Here's a baseline that takes an afternoon and removes all guesswork.

```python
# pip install rank_bm25 datasets rapidfuzz
from rank_bm25 import BM25Okapi
from datasets import load_dataset

# 1. Load a Q/A eval set that mirrors YOUR domain (not MS MARCO).
#    Build this from real support tickets, real user queries, labeled.
eval_set = load_dataset("your_org/rag_eval", split="test")
corpus = [d["text"].split() for d in load_dataset("your_org/corpus")]
bm25 = BM25Okapi(corpus)

def retrieve(query, k=10):
    return bm25.get_top_n(query.split(), corpus, n=k)

# 2. Score recall@k and nDCG@k the SAME way you'd score your vector retriever.
def recall_at_k(eval_set, k=10):
    hits = 0
    for ex in eval_set:
        ranked = retrieve(ex["query"], k)
        hits += any(gold in ranked for gold in ex["gold_doc_ids"])
    return hits / len(eval_set)

print(f"BM25 recall@10: {recall_at_k(eval_set, 10):.3f}")
```

Now run the same eval set through your production vector retriever. **Same corpus, same queries, same gold labels.** Three outcomes:

- **BM25 within ~5% of your vector retriever.** Switch. You just deleted a dependency, a reindex pipeline, an embedding endpoint, and a recurring bill. Latency drops, ops complexity drops, and quality is unchanged.
- **Vector retriever clearly ahead.** Now you have a *quantified* reason to keep it. That's worth more than vibes. Also: try hybrid (BM25 + vector + RRF fusion) and see if the gap widens or narrows.
- **It's a wash, but hybrid wins both.** Ship hybrid, but make BM25 the primary leg and vectors the tie-breaker. Cheaper, and more robust to embedding-model churn.

The eval set is the whole game. If you don't have a labeled, domain-specific eval set, your retrieval architecture is a religious choice — build the set first, then have this argument with data.

## The honest limits

BM25 loses where meaning matters more than vocabulary: cross-lingual, paraphrased natural-language queries over prose, and "find me something *like* this" semantic similarity. If your users ask "why is my pipeline slow" and your docs say "throughput degradation under backpressure," dense retrieval earns its keep.

It also struggles with morphology out of the box — `running` vs `ran` — which is why production Lucene deployments chain stemmers, synonyms, and analyzers. That tuning is real work, but it's *deterministic* work: you can read the diff, version it, and reason about it. Tuning an embedding model is not.

## The decision, compressed

| If your corpus is… | Lead with… | Why |
|---|---|---|
| Technical docs, code, logs, runbooks, entity-heavy | **BM25** | Rare tokens + exact match = ground truth of relevance |
| Natural-language prose, cross-lingual, paraphrased queries | **Dense** | Semantic match beats lexical gap |
| Mixed / you're not sure | **Hybrid (BM25 + dense, RRF)** | Pay for the vector leg only where it earns its margin |
| Tiny (<50k docs), latency-sensitive | **BM25** | Sub-ms, in-process, no network hop |
| Huge, multi-tenant, needs semantic filtering | **Dense (but benchmark BM25 first)** | You may still be surprised |

## What to do Monday morning

1. **Build the eval set.** 200–500 real queries with gold answers, sampled from your actual traffic. No eval set, no architecture argument.
2. **Run the BM25 baseline above.** One afternoon.
3. **Compare to your vector retriever on the same set.** Same metrics, same k.
4. **If BM25 is within striking distance, prototype the cutover** behind a feature flag. Measure production latency and cost for a week. The reindex pipeline you delete is pure savings.

The vector-database-as-default pattern made sense when retrieval was an open problem and dense methods were the breakthrough. They were the breakthrough. They're also not free, and for a large and growing share of production RAG workloads, the boring algorithm from 1994 is the better engineering choice — cheaper, faster, more durable, and, against the right eval set, more accurate.

Stop paying embedding prices for keyword problems. Run the baseline. The result is more often than not the same one the scaling study reported: **BM25 wins.**

---

*Footnote on sources: The scaling study referenced ("BM25 Wins at Scale: A Scaling Study of Retrieval-Augmented Generation Paradigms") was trending on Hugging Face Daily Papers at time of writing. Verify exact corpus sizes and reported deltas against the paper before quoting specific numbers in a published version — the BM25-vs-dense tradeoffs described here (keyword dominance on technical corpora, IDF on rare terms, hybrid as the practical floor) are independently well-established across the IR literature and production search engineering practice.*
