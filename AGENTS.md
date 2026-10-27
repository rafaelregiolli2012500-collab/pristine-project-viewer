<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Linha do Tempo filtering, row totals, period totals, and persistent selection derived from the existing clipped segment set so every view shares one calculation source.
- Derive combined-base comparisons from the same clipping pipeline before equipment-category selection, and use the existing summary for front totals; this keeps time and filter calculations consistent.
- Assemble front comparison series in the browser-safe timelineFrontComparison helper from existing official summaries; this separates equipment stop lines without duplicating clipping or duration calculations.
- Front-level analyses (stop counts, no-maintenance windows, maintenance rankings) live in the pure helper src/lib/timelineFrontAnalysis.ts, fed by the official clipped segments; why: one calculation source, no base mutation, testable.
- Truck telemetry uses the existing canavieiros raw base and one worker parser/shared observation-pair helper in truckTimeline; why: point telemetry needs gap-aware intervals and original counts that aggregated front segments cannot recover, while other equipment pipelines remain unchanged.
