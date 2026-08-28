# Graph Report - nails  (2026-08-28)

## Corpus Check
- 270 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3135 nodes · 6971 edges · 0 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 129 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `hasPermission()` - 125 edges
2. `_read_text()` - 123 edges
3. `dispatch_command()` - 119 edges
4. `_make_id()` - 113 edges
5. `_file_stem()` - 77 edges
6. `db` - 72 edges
7. `_rebuild_code()` - 53 edges
8. `_extract_generic()` - 40 edges
9. `extract()` - 37 edges
10. `dispatch_install_cli()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `_resolve_name()` --uses--> `LanguageConfig`  [INFERRED]
  .agents/skills/graphify/extract.py → .agents/skills/graphify/extractors/models.py
- `_extract_generic()` --uses--> `LanguageConfig`  [INFERRED]
  .agents/skills/graphify/extractors/engine.py → .agents/skills/graphify/extractors/models.py
- `_find_body()` --uses--> `LanguageConfig`  [INFERRED]
  .agents/skills/graphify/extractors/engine.py → .agents/skills/graphify/extractors/models.py
- `_dispatched_source_text()` --uses--> `FileSlice`  [INFERRED]
  .agents/skills/graphify/llm.py → .agents/skills/graphify/file_slice.py
- `_estimate_file_tokens()` --uses--> `FileSlice`  [INFERRED]
  .agents/skills/graphify/llm.py → .agents/skills/graphify/file_slice.py

## Import Cycles
- None detected.

## Communities (0 total, 0 thin omitted)

## Knowledge Gaps
- **240 isolated node(s):** `BankAccount`, `Bill`, `Payment`, `Props`, `Props` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 5 inferred relationships involving `dispatch_command()` (e.g. with `to_html()` and `_file_hash()`) actually correct?**
  _`dispatch_command()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `BankAccount`, `Bill`, `Payment` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._