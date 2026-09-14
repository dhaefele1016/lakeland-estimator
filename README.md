# Lakeland Estimating Engine

Material cost, labor hours and machine hours for **custom digital printed work** at Lakeland
Graphics — from size, quantity and material.

A deliberate **stop-gap**, expected life ~6 months, until a new MIS is selected. It replaces
nothing: Sage 100 continues to handle product-based estimating for the catalogue, and Lotus
Approach continues to own job jackets. This tool exists to take custom decal and custom overlay
estimating out of Sage, where it is slow.

Live version: deployed from this repo to Vercel.

---

## What it covers

**In scope — one process route:**

```
Epson roll print → laminate → (mount to rigid) → flatbed die cut
```

- Custom decals — printed vinyl, overlaminate, through or kiss cut
- Custom overlays on rigid — second-surface print, 9505 transfer adhesive, mounted to acrylic

**Out of scope, by decision:**

- Catalogue / product-based estimating — stays in Sage
- Screen press work — all catalogue product, so the screen route is not modelled
- Banners, large-format vinyl, magnetics and one-off signage — deferred until the volume
  justifies it. Adding them means a finishing operation (hem, grommet, pole pocket) that the
  model does not currently have.

---

## Equipment

| | |
|---|---|
| **Printer** | Epson SureColor **S80600** (regulatory model K271A). 64" max media, 10-colour UltraChrome GS3 solvent. Modes: draft 1,020 / production banner 340 / production vinyl 195 / **quality vinyl 140 ft²/hr**. |
| **Die cutter** | Graphtec **FCX2000-120VC** flatbed. **47.2 × 36"** cutting area, vacuum hold-down, 400 mm/s max, two tool heads. |
| **Laminator** | Make and model **unknown** — placeholder cost in the rate table. |

**Known constraint the model handles explicitly:** the workhorse acrylic sheet is 24.5 × 48.5"
and the cutter bed is 47.2 × 36". The sheet does not fit in either orientation, so every mounted
sheet is trimmed into 2 panels before die cutting. That is almost certainly what the legacy
0.3 hr "pre-cut" standard in the Approach data was paying for.

---

## The model

### Every line is a standalone run

**No ganging is assumed.** Each quote line carries its own press, laminator and cutter setup and
its own leader waste, even when several lines would obviously run together on one web. Production
is free to gang and keep the gain.

This is a deliberate estimating conservatism decided by Doug — **do not "optimise" it without
revisiting that decision.** The only exception is pack & ship, charged once per quote and
allocated across lines by piece count.

### Roll imposition

```
usable  = rollWidth − 2 × edgeMargin
across  = floor((usable + gutter) / (partW + gutter))      ← best of both orientations
rows    = ceil(qty / across)
runFt   = (rows × (partH + gutter) + gutter) / 12 + leaderWaste
webSqft = runFt × rollWidth / 12
yield   = (qty × partW × partH / 144) / webSqft
```

Roll materials — film, overlaminate, adhesive — are charged at **their own roll's linear-foot
price × runFt**, with `passes = ceil(webWidth / materialWidth)` when the material is narrower than
the web. You pay for the full width of the roll you mounted, not the area you imaged. The tool
flags it when a material roll is more than 1.4× the nest width, because that is a purchasing
decision rather than an estimating one.

### Sheet imposition

```
perSheet = max over both rotations of
           floor((sheetW − 2·trim + g)/(w + g)) × floor((sheetH − 2·trim + g)/(h + g))
sheets   = ceil(qty / perSheet) + makereadySheets
panels   = sheets × splitK        splitK = trims needed to clear the 47.2 × 36" bed
```

### Labor

```
labor $ = labor hours × (work-centre wage × 1.30)
```

Wages come from the Sept 2026 payroll sheet; the 30% burden is fringe only — payroll tax,
benefits, PTO. It does not cover equipment or facility, which come through the machine rate.

The interface shows **work-centre roles, not employee names**, so the deployed page can be shared
without exposing pay. The wage figures are still present in the rates panel.

### Machine cost rate

```
$/machine hour = replacementCost / usefulLife / productiveHours
               + annualService / productiveHours
               + kW × $/kWh
```

**Productive hours = 600/yr.** This is the most sensitive assumption in the whole model — at
1,664 hr/yr the press rate falls from $13.11 to $4.87. 600 is corroborated independently by ink
purchases: 101 cartridges since May '25 ≈ 70.7 L, against 75.6 L predicted by the model at 600
hours and 75% coverage.

| At | Epson | Laminator | Graphtec |
|---|---|---|---|
| 1,664 hr/yr | $4.87 | $1.20 | $2.73 |
| 1,000 hr/yr | $7.95 | $1.88 | $4.46 |
| **600 hr/yr** | **$13.11** | **$3.01** | **$7.36** |

### Price

```
sell = cost ÷ (1 − margin)          margin default 35%, set per quote
```

Cost is **direct conversion cost** — material, burdened labor, machine rate. No facility
overhead, G&A, freight or commission. Real gross margin lands below the figure shown.

---

## Where the numbers come from

Every parameter in the rates panel is tagged with its source:

| Tag | Meaning |
|---|---|
| `vendor PO` | Real purchase price from 2024–26 invoices — Grimco, Adhue, TapeCase, Polymershapes, North Light Color |
| `payroll` | Lakeland payroll sheet, Sept 2026 |
| `machine spec` | Published Epson / Graphtec specification |
| `dealer list` | Dealer list price for replacement cost |
| `legacy Approach` | Reverse-engineered from the Lotus Approach estimating standards |
| `shop input` | **Placeholder — not yet confirmed by the floor** |

Notable real costs:

- Acrylic 15 mil V/G 24.5 × 48.5 — **$5.64/sheet**, 19,670 sheets bought. The workhorse substrate.
- 3M 9505 transfer adhesive 24" — **$878.51/roll**, $1.63/linear ft. Most expensive layer in a
  2-surface part.
- 3M 8519 luster overlaminate 54" — **$619/roll**, $4.13/linear ft. Running that over a 24" nest
  gives away about 55%.
- UltraChrome GS3 ink — **$216/cartridge**, $0.309/ml assuming 700 ml carts (**verify cart size**).

The legacy **300 pcs/hr press standard is deliberately not used.** It is a screen-press number and
the source data flags the digital rate as unverified; digital print time runs on the Epson's
published ft²/hr instead.

---

## Still to confirm with the shop

Ranked by how much each moves the answer:

1. Productive machine hours per year (600 — corroborated by ink, still worth confirming)
2. Blade speed realised and pass count on through-cut acrylic (7.9 in/s, 0.55 efficiency, 2 passes)
3. The laminator's make, model, replacement cost and real speed (8 ft/min is a guess)
4. Per-machine annual service and consumable spend
5. Weed and inspect (6 sec/piece), mount (1.5 min/sheet), operator attendance factors
6. Drying / cure time — **not modelled at all.** Solvent needs outgas before lamination.
7. Ink cartridge volume — 700 ml assumed
8. Film durability for fuel-splash zones. IJ35C is what Lakeland buys in volume (53 rolls), but a
   cast film is the usual spec near fuel.

---

## Roadmap

- [x] Cost model, multi-line quotes, customer block, per-line imposition
- [x] Real crew rates with 30% burden; machine rates built from replacement cost
- [ ] Demote the base-part lookup — custom size is the primary path, not the catalogue
- [ ] Simplify the default view to size / quantity / material; collapse the detail
- [ ] Extract the cost model into `model.js` with no DOM dependency, so it is testable and portable
- [ ] Saved estimates in Postgres, **with a snapshot of the rates that produced them**
- [ ] Branded PDF quote output
- [ ] Full CSV/JSON export of every table

### Two decisions to hold

**Saved estimates snapshot their rates.** Reopening a February estimate in May must reproduce
February's number. Re-pricing at current rates makes estimate-versus-actual comparison meaningless.

**Everything exports, from the first commit.** Stop-gaps outlive their estimates. The test of a
good one is that its data can leave cleanly.

### What the database is actually for

Not operational storage — a **calibration log**. Over six months it accumulates what the model
said, what was actually quoted, and whether the job was won. That is what turns the `shop input`
placeholders into real numbers, and what informs the next MIS decision.

---

## Running it

Static single file. No build step, no dependencies. Open `index.html`, or deploy the repo to
Vercel as-is. The only external request is Google Fonts, and it degrades cleanly without it.
Rate edits persist to `localStorage` per browser.

## Related project documents

In the "LG Migration" Claude project:

- `claude/Quoting_Engine_Cost_Model.md` — the model in full, with worked examples
- `Decision_and_Open_Questions_Log.md` — project decisions and open items
- `Approach_Sage_DataModel_and_SourceOfRecord.md` — legacy system source-of-record map
- `Base_Part_Process_Template_v2.xlsx` — 585 base parts, blank sizes, dies, substrate
