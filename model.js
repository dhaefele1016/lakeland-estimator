/* Lakeland estimator — the cost model.
 *
 * Extracted from index.html, September 2026. No DOM, no localStorage, no page
 * globals: everything the model needs arrives in a context built by
 * createContext({params, stock, custom}). That is what lets node run it for the
 * golden tests today and the server run it against a rate snapshot later.
 *
 * The data tables and the body of calcLine/quote were lifted verbatim from the
 * single-file build; only the function signatures changed. test/golden.json
 * pins the behaviour of the version this came from — see tools/capture-golden.js.
 *
 * MODEL_VERSION is stored on every saved estimate. Bump it whenever a change
 * here would move a number, because rate snapshots alone will not make an old
 * estimate reproduce.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LGModel = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

const MODEL_VERSION = '1.1.0';

/* ---------------- material library (real purchase prices) ---------------- */
const R=(w,lenFt,cost)=>({rollW:w,lenFt,cost,psf:cost/(w/12*lenFt)});
const FILMS=[
 {id:'ij35c54', n:'3M IJ35C matte white w/Comply 54"', v:'Grimco · 53 rl', ...R(54,150,230.46)},
 {id:'ij35c60', n:'3M IJ35C matte white w/Comply 60"', v:'Grimco · 1 rl',  ...R(60,150,259.47)},
 {id:'or3651',  n:'Orajet 3651GRA gloss white 54"',    v:'Grimco · 6 rl',  ...R(54,150,367.47)},
 {id:'arlon',   n:'Arlon 4500GLX Xscape gloss 54"',    v:'Grimco · 1 rl',  ...R(54,150,240.16)},
 {id:'3m50t',   n:'3M 50 transparent 24"',             v:'Grimco · 155 rl',...R(24,150,147.47)},
 {id:'o651c',   n:'Oracal 651 clear 24"',              v:'Grimco · 68 rl', ...R(24,150,134.86)},
 {id:'o651w',   n:'Oracal 651 white 24"',              v:'Grimco · 19 rl', ...R(24,150,103.12)},
 {id:'adh35',   n:'3.5 mil white matte perm 27"',      v:'Adhue · 4 rl',   ...R(27,150,98.96)},
 {id:'adh23',   n:'2.3 mil white barrier 27"',         v:'Adhue · 2 rl',   ...R(27,150,87.48)},
 {id:'pvcflex', n:'PVC Flex 3.2 mil white perm 54"',   v:'Adhue · 1 rl',   ...R(54,150,197.92)},
 {id:'mag',     n:'NF flex magnet .030 24.375"',       v:'Grimco · 2 rl',  ...R(24.375,50,167.95)},
];
const OLAMS=[
 {id:'none', n:'None', v:'', rollW:0,lenFt:0,cost:0,psf:0},
 {id:'8519_54', n:'3M 8519 luster overlam 54"',   v:'Grimco · 41 rl', ...R(54,150,618.99)},
 {id:'8518_485',n:'3M 8518 gloss overlam 48.5"',  v:'Grimco · 17 rl', ...R(48.5,150,550.80)},
 {id:'8518_54', n:'3M 8518 gloss overlam 54"',    v:'Grimco · 1 rl',  ...R(54,150,679.92)},
 {id:'8519_485',n:'3M 8519 luster overlam 48.5"', v:'Grimco · 8 rl',  ...R(48.5,150,608.08)},
 {id:'adhpet',  n:'Clear PET perm 1 mil 27"',     v:'Adhue · 2 rl',   ...R(27,750,189.74)},
];
const ADHS=[
 {id:'none', n:'None', v:'', rollW:0,lenFt:0,cost:0,psf:0},
 {id:'9505_18', n:'3M 9505 adhesive transfer 18"', v:'TapeCase · 180 yd', ...R(18,540,732.18)},
 {id:'9505_24', n:'3M 9505 adhesive transfer 24"', v:'TapeCase · 180 yd', ...R(24,540,878.51)},
];
const S=(w,h,cost)=>({shW:w,shH:h,cost,psf:cost/(w*h/144)});
const RIGIDS=[
 {id:'none', n:'None', v:'', shW:0,shH:0,cost:0,psf:0},
 {id:'acr15', n:'Acrylic 15 mil V/G 24.5×48.5', v:'Adhue · 19,670 sh', ...S(24.5,48.5,5.64)},
 {id:'acr10g',n:'Acrylic 10 mil V/G 24.5×48.5', v:'Adhue · 400 sh',    ...S(24.5,48.5,4.52)},
 {id:'acr10m',n:'Acrylic 10 mil V/M 24.5×48.5', v:'Adhue · 25 sh',     ...S(24.5,48.5,4.08)},
 {id:'pc15',  n:'Polycarb 15 mil V/G 24×48',    v:'Adhue · 550 sh',    ...S(24,48,4.08)},
 {id:'pc10',  n:'Polycarb 10 mil V/M 24×48',    v:'Adhue · 300 sh',    ...S(24,48,2.85)},
 {id:'pc30',  n:'Polycarb 30 mil G/G 24×48',    v:'Adhue · 39 sh',     ...S(24,48,10.64)},
 {id:'pc60',  n:'Lexan .060 24×48',             v:'Polymershapes',     ...S(24,48,21.67)},
 {id:'pc030s',n:'Polycarb .030 16×16.875',      v:'Polymershapes',     ...S(16,16.875,4.17)},
 {id:'pvc15', n:'PVC 15 mil white 25×52',       v:'Adhue · 50 sh',     ...S(25,52,2.84)},
 {id:'pvc20', n:'PVC 20 mil white 25×52',       v:'Adhue · 25 sh',     ...S(25,52,3.47)},
 {id:'sty30', n:'Styrene .030 48×96',           v:'Adhue · 207 sh',    ...S(48,96,13.60)},
 {id:'fpvc',  n:'Foam PVC .118 24×48',          v:'Polymershapes',     ...S(24,48,9.40)},
];
const byId=(arr,id)=>arr.find(x=>x.id===id)||arr[0];

/* Work centres — rates from the Lakeland payroll sheet, Sept 2026. Roles, not names. */
const CREW=[
 {id:'mai',   n:'Production artist',      w:33.00, r:'Artwork setup and prepress'},
 {id:'diana', n:'Digital press operator', w:45.00, r:'Runs all digital print jobs; production management'},
 {id:'terry', n:'Laminator operator',     w:26.75, r:'Laminating, mounting, die cutting'},
 {id:'mark',  n:'Die cutter operator',    w:31.00, r:'Flatbed die cutting'},
 {id:'karen', n:'Inspection / shipping',   w:23.25, r:'Product inspection, packing, order fill'},
 {id:'todd',  n:'Screen production',      w:28.00, r:'Screen making and reclaim; backup finishing'},
 {id:'brian', n:'Screen press operator',  w:28.00, r:'Screen printing'},
 {id:'andy',  n:'Estimator / purchasing', w:46.25, r:'Estimating, raw material purchasing, job tickets'},
 {id:'tim',   n:'Account coordinator',    w:47.50, r:'Order coordination through delivery'},
];
const ROLES=[
 {k:'opArt',    l:'Prepress / artwork',  d:'mai'},
 {k:'opPrint',  l:'Print — Epson',       d:'diana'},
 {k:'opLam',    l:'Laminate',            d:'terry'},
 {k:'opMount',  l:'Mount to substrate',  d:'terry'},
 {k:'opPrecut', l:'Pre-cut to bed',      d:'terry'},
 {k:'opCut',    l:'Die cut',             d:'mark'},
 {k:'opWeed',   l:'Weed &amp; inspect',      d:'karen'},
 {k:'opShip',   l:'Pack &amp; ship',         d:'karen'},
];
const PARAMS=[
 {g:'Press — Epson S80600', k:'gutter',    l:'Gutter between parts (in)',       d:0.25, s:'shop'},
 {g:'Press — Epson S80600', k:'edge',      l:'Unprintable edge each side (in)', d:0.5,  s:'spec'},
 {g:'Press — Epson S80600', k:'maxPrintW', l:'Max printed width used (in)',     d:46,   s:'shop'},
 {g:'Press — Epson S80600', k:'leadFt',    l:'Leader + trailer waste per run (ft)', d:3, s:'shop'},
 {g:'Press — Epson S80600', k:'printSetup',l:'Load, RIP &amp; colour check (hr)',   d:0.25, s:'shop'},
 {g:'Press — Epson S80600', k:'inkMl',     l:'Ink at 100% coverage (ml/sq ft)', d:1.2,  s:'shop'},
 {g:'Press — Epson S80600', k:'inkCost',   l:'Ink cost ($/ml) — $216 per 700 ml cart', d:0.3086, s:'po'},
 {g:'Press — Epson S80600', k:'printAtt',  l:'Operator attendance on run (×)',  d:0.35, s:'shop'},

 {g:'Laminate &amp; mount', k:'lamFtMin',  l:'Laminator speed (ft/min) — 463TH tops out at 13', d:8, s:'spec'},
 {g:'Laminate &amp; mount', k:'mOverlam',  l:'Machine — overlaminate pass', d:'l463',  s:'shop', type:'mach'},
 {g:'Laminate &amp; mount', k:'mAdhesive', l:'Machine — adhesive pass',     d:'l2426', s:'shop', type:'mach'},
 {g:'Laminate &amp; mount', k:'mMount',    l:'Machine — mount to rigid',    d:'l463',  s:'shop', type:'mach'},
 {g:'Laminate &amp; mount', k:'lamSetup',  l:'Laminator setup per pass (hr)',   d:0.15, s:'shop'},
 {g:'Laminate &amp; mount', k:'mountMin',  l:'Mount to rigid (min/sheet)',      d:1.5,  s:'shop'},
 {g:'Laminate &amp; mount', k:'precutHr',  l:'Pre-cut / trim to bed (hr)',      d:0.3,  s:'leg'},
 {g:'Laminate &amp; mount', k:'sheetTrim', l:'Sheet edge trim each side (in)',  d:0.25, s:'shop'},
 {g:'Laminate &amp; mount', k:'setupSh',   l:'Makeready sheets per run',        d:1,    s:'shop'},

 {g:'Die cut — FCX2000', k:'bedW',      l:'Cutter bed width (in)',            d:47.2, s:'spec'},
 {g:'Die cut — FCX2000', k:'bedH',      l:'Cutter bed depth (in)',            d:36,   s:'spec'},
 {g:'Die cut — FCX2000', k:'cutIps',    l:'Blade speed (in/sec)',             d:7.9,  s:'spec'},
 {g:'Die cut — FCX2000', k:'cutEff',    l:'Speed realised, accel/decel (×)',  d:0.55, s:'shop'},
 {g:'Die cut — FCX2000', k:'pathFac',   l:'Path vs. perimeter, cut-outs (×)', d:1.15, s:'shop'},
 {g:'Die cut — FCX2000', k:'passThru',  l:'Passes — through cut',             d:2,    s:'shop'},
 {g:'Die cut — FCX2000', k:'setupThru', l:'Setup — through cut (hr)',         d:0.25, s:'leg'},
 {g:'Die cut — FCX2000', k:'setupKiss', l:'Setup — kiss cut (hr)',            d:0.30, s:'leg'},
 {g:'Die cut — FCX2000', k:'loadMin',   l:'Load, register, unload (min/panel)',d:0.5, s:'shop'},
 {g:'Die cut — FCX2000', k:'cutAtt',    l:'Operator attendance on cut (×)',   d:0.8,  s:'shop'},

 {g:'Labor, finishing &amp; rates', k:'artNew',   l:'Prepress — new graphic (hr)', d:0.75, s:'shop'},
 {g:'Labor, finishing &amp; rates', k:'artRep',   l:'Prepress — repeat (hr)',      d:0.10, s:'shop'},
 {g:'Labor, finishing &amp; rates', k:'weedSec',  l:'Weed &amp; inspect (sec/piece)',  d:6,   s:'shop'},
 {g:'Labor, finishing &amp; rates', k:'shipHr',   l:'Pack &amp; ship per QUOTE (hr)',  d:0.2, s:'leg'},
 {g:'Labor, finishing &amp; rates', k:'spoil',    l:'Material spoilage (%)',       d:5,    s:'shop'},
 {g:'Labor, finishing &amp; rates', k:'margin',   l:'Target gross margin (%)',     d:35,   s:'shop'},
 {g:'Crew &amp; burden', k:'burden', l:'Burden on wages (%)', d:30, s:'shop'},

 {g:'Machine cost rates', k:'util', l:'Productive hours per machine, per year', d:600, s:'shop'},
 {g:'Machine cost rates', k:'elec', l:'Electricity ($/kWh)', d:0.12, s:'shop'},
 {g:'Machine cost rates', k:'cap_press', l:'Epson — replacement cost ($)', d:23685, s:'mkt'},
 {g:'Machine cost rates', k:'life_press',l:'Epson — useful life (yr)', d:5, s:'shop'},
 {g:'Machine cost rates', k:'svc_press', l:'Epson — service, heads, parts ($/yr)', d:3000, s:'shop'},
 {g:'Machine cost rates', k:'kw_press',  l:'Epson — draw (kW)', d:1.8, s:'shop'},
 {g:'Machine cost rates', k:'cap_cut',   l:'Graphtec — replacement cost ($)', d:22000, s:'mkt'},
 {g:'Machine cost rates', k:'life_cut',  l:'Graphtec — useful life (yr)', d:7, s:'shop'},
 {g:'Machine cost rates', k:'svc_cut',   l:'Graphtec — blades, mats, service ($/yr)', d:1200, s:'shop'},
 {g:'Machine cost rates', k:'kw_cut',    l:'Graphtec — draw with vacuum (kW)', d:1.0, s:'shop'},
 {g:'Machine cost rates', k:'cap_l463',  l:'GFP 463TH — replacement cost ($)', d:6508, s:'mkt'},
 {g:'Machine cost rates', k:'life_l463', l:'GFP 463TH — useful life (yr)', d:10, s:'shop'},
 {g:'Machine cost rates', k:'svc_l463',  l:'GFP 463TH — rollers, service ($/yr)', d:500, s:'shop'},
 {g:'Machine cost rates', k:'kw_l463',   l:'GFP 463TH — draw (kW)', d:1.5, s:'shop'},
 {g:'Machine cost rates', k:'cap_l2426', l:'Flexcon 2426F — replacement cost ($)', d:5000, s:'shop'},
 {g:'Machine cost rates', k:'life_l2426',l:'Flexcon 2426F — useful life (yr)', d:10, s:'shop'},
 {g:'Machine cost rates', k:'svc_l2426', l:'Flexcon 2426F — service ($/yr)', d:400, s:'shop'},
 {g:'Machine cost rates', k:'kw_l2426',  l:'Flexcon 2426F — draw (kW)', d:1.0, s:'shop'},
 {g:'Machine cost rates', k:'cap_l230',  l:'GFP 230C — replacement cost ($)', d:3000, s:'shop'},
 {g:'Machine cost rates', k:'life_l230', l:'GFP 230C — useful life (yr)', d:10, s:'shop'},
 {g:'Machine cost rates', k:'svc_l230',  l:'GFP 230C — service ($/yr)', d:250, s:'shop'},
 {g:'Machine cost rates', k:'kw_l230',   l:'GFP 230C — draw (kW)', d:0.8, s:'shop'},
 ...CREW.map(c=>({g:'Crew &amp; burden', k:'w_'+c.id, l:`${c.n} — ${c.r.split('—')[0].trim()} ($/hr)`, d:c.w, s:'pay'})),
 ...ROLES.map(r=>({g:'Who runs what', k:r.k, l:r.l, d:r.d, s:'shop', type:'sel'})),
];
const DEF=Object.fromEntries(PARAMS.map(p=>[p.k,p.d]));
const MACH=[
 {k:'press', n:'Epson S80600',   sub:'64" solvent roll'},
 {k:'l463',  n:'GFP 463TH',      sub:'63" top heat · overlaminate + mount'},
 {k:'l2426', n:'Flexcon 2426F',  sub:'26" · adhesive films'},
 {k:'l230',  n:'GFP 230C',       sub:'30" compact · small jobs'},
 {k:'cut',   n:'Graphtec FCX2000', sub:'47.2 × 36" flatbed'},
];
/* The stock selection a fresh quote starts from. Lives here rather than in the
   page so the server resolves the same defaults. */
const DEFAULT_STOCK={film2:'3m50t',adh2:'9505_24',rig2:'acr15',back2:'o651w',film1:'ij35c54',olam1:'8519_54',mode:140,cov:0.75};

/* Number formatting used inside the model's own explanatory strings. Shared with
   the page so the two never drift. */
const m4=n=>'$'+(n<1?n.toFixed(3):n.toFixed(2));
const f2=n=>n.toFixed(2);

function machParts(P,m,hours){
  const hrs=Math.max(1,hours==null?+P.util:hours);
  const cap=(+P['cap_'+m])/Math.max(1,+P['life_'+m])/hrs;
  const svc=(+P['svc_'+m])/hrs;
  const pwr=(+P['kw_'+m])*(+P.elec);
  return {cap,svc,pwr,tot:cap+svc+pwr};
}
const machName=k=>(MACH.find(m=>m.k===k)||{n:k}).n;

/* Everything the model reads, resolved once. Pass params/stock/custom straight
   from the UI today, or from a rate_snapshot row on the server later. */
function createContext(opts){
  opts=opts||{};
  const P=Object.assign({},DEF,opts.params||{});
  const custom=(opts.custom||[]).slice();
  const stock=Object.assign({},DEFAULT_STOCK,opts.stock||{});
  const rolls =()=>custom.filter(c=>c.kind==='roll');
  const sheets=()=>custom.filter(c=>c.kind==='sheet');
  const ctx={
    P, stock, custom,
    FILMS_ALL :()=>[...FILMS, ...rolls()],
    OLAMS_ALL :()=>[...OLAMS, ...rolls()],
    ADHS_ALL  :()=>[...ADHS,  ...rolls()],
    RIGIDS_ALL:()=>[...RIGIDS,...sheets()],
  };
  ctx.machParts=(m,hours)=>machParts(P,m,hours);
  ctx.machRate =m=>machParts(P,m).tot;
  ctx.crewOf=k=>CREW.find(c=>c.id===P[k])||CREW[0];
  ctx.wageOf=k=>+P['w_'+ctx.crewOf(k).id]||ctx.crewOf(k).w;
  ctx.rateOf=k=>ctx.wageOf(k)*(1+(+P.burden)/100);
  return ctx;
}

/* ---------------- the model: one line = one standalone run ---------------- */
function calcLine(ctx,L,qtyOverride){
  const P=ctx.P, stock=ctx.stock;
  const qRaw = qtyOverride!=null? qtyOverride : +L.qty;
  if(!(+L.w>0)||!(+L.h>0)||!(qRaw>0)) return {empty:true,L,w:+L.w||0,h:+L.h||0,qty:+qRaw||0};
  const w=Math.max(.05,+L.w), h=Math.max(.05,+L.h);
  const qty=Math.max(1,Math.round(qRaw));
  const two = L.con==='2'||L.con==='3';
  const backed = L.con==='3';
  const film = byId(ctx.FILMS_ALL(), two?stock.film2:stock.film1);
  const olam = two? byId(OLAMS,'none') : byId(ctx.OLAMS_ALL(),stock.olam1);
  const adh  = two? byId(ctx.ADHS_ALL(),stock.adh2) : byId(ADHS,'none');
  /* A rigid of None behaves exactly as no rigid at all — same test the
     overlaminate and adhesive already use. Everything downstream keys off `rig`
     being null: no sheet imposition, no substrate cost, no mount pass, no
     pre-cut, and no sheet-fit error. The panel count falls back to the roll
     branch, which is what the flatbed actually gets. */
  const rigSel = two? byId(ctx.RIGIDS_ALL(),stock.rig2) : null;
  const rig  = (rigSel && rigSel.psf>0)? rigSel : null;
  const back = backed? byId(ctx.FILMS_ALL(),stock.back2) : null;
  const speed=+stock.mode, cov=+stock.cov, g=+P.gutter;
  const warn=[], info=[];

  const usable=Math.min(film.rollW-2*(+P.edge), +P.maxPrintW);
  const acrossOf=pw=>Math.floor((usable+g)/(pw+g));
  const a1=acrossOf(w), a2=acrossOf(h);
  const rot=a2>a1, pw=rot?h:w, ph=rot?w:h, across=Math.max(a1,a2);
  if(across<1) return {error:`${w}" × ${h}" will not fit a ${film.rollW}" roll with ${P.edge}" edges.`,L,w,h,qty};
  const rows=Math.ceil(qty/across);
  const runFt=(rows*(ph+g)+g)/12 + (+P.leadFt);
  const webSqft=runFt*film.rollW/12;
  const partSqft=qty*w*h/144;
  const prodFt=(rows*(ph+g)+g)/12;              // run length before leader
  const widthUse=(across*(pw+g)-g)/film.rollW;  // share of ROLL width the nest occupies
  const printUse=(across*(pw+g)-g)/usable;      // share of PRINTABLE width used
  const lengthUse=prodFt/runFt;                 // share of run length that is product
  const yld=partSqft/webSqft;                   // overall material used; 1-yld is the waste factor

  let sheets=0,perSheet=0,panels=0,splitK=1,sheetW=0,sheetH=0;
  if(two&&rig){
    sheetW=rig.shW; sheetH=rig.shH;
    const uw=sheetW-2*P.sheetTrim, uh=sheetH-2*P.sheetTrim;
    const fit=(a,b)=>Math.max(0,Math.floor((uw+g)/(a+g)))*Math.max(0,Math.floor((uh+g)/(b+g)));
    perSheet=Math.max(fit(w,h),fit(h,w));
    if(perSheet<1) return {error:`${w}" × ${h}" will not fit a ${sheetW}×${sheetH}" sheet.`,L,w,h,qty};
    sheets=Math.ceil(qty/perSheet)+(+P.setupSh);
    const fitsBed=(sheetW<=P.bedW&&sheetH<=P.bedH)||(sheetH<=P.bedW&&sheetW<=P.bedH);
    if(!fitsBed){
      splitK=Math.max(2,Math.ceil(Math.max(sheetW,sheetH)/(+P.bedW)));
      warn.push(`The ${sheetW}×${sheetH}" sheet is larger than the ${P.bedW}×${P.bedH}" cutter bed, so it is trimmed into ${splitK} panels before die cutting.`);
    }
    panels=sheets*splitK;
  } else {
    perSheet=Math.max(1,Math.floor((P.bedH+g)/(ph+g)))*across;
    panels=Math.ceil(qty/perSheet);
  }

  const mats=[], webW=film.rollW;
  const rollLine=m=>{
    const passes=Math.max(1,Math.ceil(webW/m.rollW));
    const linFt=runFt*passes, perFt=m.cost/m.lenFt;
    if(passes>1) warn.push(`${m.n} is ${m.rollW}" against a ${webW}" web — ${passes} passes, ${f2(linFt)} linear feet.`);
    if(m.rollW>webW*1.4) info.push(`${m.n} is ${m.rollW}" over a ${webW}" nest — you pay the full roll width.`);
    return {n:m.n,v:m.v,q:`${f2(linFt)} lin ft @ ${m.rollW}"`,u:m4(perFt)+'/lin ft',c:linFt*perFt,src:m.custom?'usr':'po'};
  };
  mats.push(rollLine(film));
  if(olam.psf>0) mats.push(rollLine(olam));
  if(backed&&back) mats.push(rollLine(back));
  if(two&&adh.psf>0) mats.push(rollLine(adh));
  if(two&&rig) mats.push({n:rig.n,v:rig.v,q:`${sheets} sheet${sheets===1?'':'s'} · ${perSheet} up`,u:m4(rig.cost)+'/sh',c:sheets*rig.cost,src:rig.custom?'usr':'po'});
  const inkMl=partSqft*1.05*(+P.inkMl)*cov;
  mats.push({n:'UltraChrome GS3 ink',v:'North Light Color · $216/cart',q:`${inkMl.toFixed(0)} ml @ ${Math.round(cov*100)}%`,u:m4(+P.inkCost)+'/ml',c:inkMl*P.inkCost,src:'po'});
  // roll goods that never become product — computed for future reporting, not displayed:
  // the material is resold at margin like any other, so a dollar figure reads as a loss when it isn't
  const rollMats=mats.filter(m=>/lin ft/.test(m.q));
  const rollCost=rollMats.reduce((s,m)=>s+m.c,0);
  const perSqftPaid = webSqft? rollCost/webSqft : 0;
  const wasteCost = rollCost - partSqft*perSqftPaid;
  const matSub=mats.reduce((s,m)=>s+m.c,0);
  const spoilC=matSub*(+P.spoil)/100;
  const matTotal=matSub+spoilC;

  const ops=[];
  const add=(n,mh,lh,rate,role,fx)=>{
    const lr=ctx.rateOf(role), who=ctx.crewOf(role);
    ops.push({n,mh,lh,c:mh*rate+lh*lr,fx,who:who.n,lr});
  };
  const artHr=L.art==='new'?+P.artNew:+P.artRep;
  add('Prepress / artwork',0,artHr,0,'opArt',`${L.art==='new'?'new graphic':'repeat'} → ${f2(artHr)} hr`);
  add('Screen prep',0,0,0,'opArt','digital route — no screens, 0 hr');
  const printRun=webSqft/speed;
  add('Print — Epson S80600',(+P.printSetup)+printRun,(+P.printSetup)+printRun*(+P.printAtt),ctx.machRate('press'),'opPrint',
      `${f2(webSqft)} ft² ÷ ${speed} ft²/hr + ${f2(+P.printSetup)} setup`);
  const passHr=()=> (+P.lamSetup)+(runFt/(+P.lamFtMin)/60);
  const passFx=()=>`${f2(+P.lamSetup)} setup + ${f2(runFt)} ft ÷ ${P.lamFtMin} ft/min`;
  if(olam.psf>0){
    const m=P.mOverlam, hr=passHr();
    add(`Overlaminate — ${machName(m)}`,hr,hr,ctx.machRate(m),'opLam',passFx());
  }
  if(backed&&back){
    const m=P.mOverlam, hr=passHr();
    add(`Backer vinyl — ${machName(m)}`,hr,hr,ctx.machRate(m),'opLam',passFx());
  }
  if(two&&adh.psf>0){
    const m=P.mAdhesive, hr=passHr();
    add(`Adhesive — ${machName(m)}`,hr,hr,ctx.machRate(m),'opLam',passFx());
  }
  if(two&&rig){
    const m=P.mMount, hr=sheets*(+P.mountMin)/60;
    add(`Mount to substrate — ${machName(m)}`,hr,hr,ctx.machRate(m),'opMount',
        `${sheets} sheets × ${P.mountMin} min — machine time, not just handling`);
  }
  if(splitK>1) add('Pre-cut to cutter bed',+P.precutHr,+P.precutHr,ctx.machRate('cut'),'opPrecut',`flat ${f2(+P.precutHr)} hr — sheet exceeds bed`);
  const passes=L.dcut==='through'?(+P.passThru):1;
  const cutSetup=L.dcut==='through'?(+P.setupThru):(+P.setupKiss);
  const pathIn=qty*2*(w+h)*(+P.pathFac)*passes;
  const cutRun=pathIn/((+P.cutIps)*3600)/(+P.cutEff);
  const loadHr=panels*(+P.loadMin)/60;
  add(`Die cut — ${L.dcut==='through'?'through':'kiss'}`,cutSetup+cutRun+loadHr,cutSetup+loadHr+cutRun*(+P.cutAtt),ctx.machRate('cut'),'opCut',
      `${(pathIn/12).toFixed(0)} ft path ÷ (${P.cutIps} in/s × ${P.cutEff}) + ${panels} panel loads + ${f2(cutSetup)} setup`);
  add('Weed &amp; inspect',0,qty*(+P.weedSec)/3600,0,'opWeed',`${qty} × ${P.weedSec} sec`);

  const mh=ops.reduce((s,o)=>s+o.mh,0), lh=ops.reduce((s,o)=>s+o.lh,0);
  const conv=ops.reduce((s,o)=>s+o.c,0);
  if(yld<0.45) info.push(`${((1-yld)*100).toFixed(0)}% of the film is waste on this line. ${(printUse*100).toFixed(0)}% of the ${usable}" printable width is used, and a ${P.leadFt} ft leader sits on ${f2(prodFt)} ft of product.`);
  if(printUse>0.9 && film.rollW>usable+4) info.push(`The nest fills the ${usable}" print width, but you buy ${film.rollW}" film and pay for all of it — ${((1-widthUse)*100).toFixed(0)}% of the roll width is never printed.`);
  return {L,w,h,qty,two,backed,across,rot,rows,runFt,prodFt,webSqft,partSqft,yld,widthUse,printUse,lengthUse,usable,perSheet,sheets,panels,splitK,sheetW,sheetH,
          mats,matSub,spoilC,matTotal,wasteCost,rollCost,ops,mh,lh,conv,base:matTotal+conv,film,rig,pw,ph,warn,info};
}

function quote(ctx,lines,qtyOverride,marginPct){
  const P=ctx.P;
  const mg = marginPct==null? (+P.margin) : marginPct;
  const res=lines.map(L=>calcLine(ctx,L,qtyOverride));
  const good=res.filter(r=>!r.error&&!r.empty);
  const pcsReal=good.reduce((s,r)=>s+r.qty,0);
  const pcs=pcsReal||1;
  const shipHr=+P.shipHr, shipC=shipHr*ctx.rateOf('opShip');
  good.forEach(r=>{
    r.shipHr=shipHr*(r.qty/pcs);
    r.total=r.base+shipC*(r.qty/pcs);
    r.unit=r.total/r.qty;
    r.price=r.unit/(1-mg/100);
    r.ext=r.price*r.qty;
  });
  return {mg,res,good,pcs,pcsReal,shipHr,shipC,
    mat:good.reduce((s,r)=>s+r.matTotal,0),
    conv:good.reduce((s,r)=>s+r.conv,0)+shipC,
    mh:good.reduce((s,r)=>s+r.mh,0),
    lh:good.reduce((s,r)=>s+r.lh,0)+shipHr,
    total:good.reduce((s,r)=>s+r.total,0),
    price:good.reduce((s,r)=>s+r.ext,0)};
}

/* ---------------- quantity breaks ---------------- */
// Each break is a full independent re-run: imposition, sheets and panels are all
// recomputed. Never interpolate — the cost curve is a staircase and it steps UP
// whenever one more piece forces another row on the web or another sheet.
function breakQuotes(ctx,lines,breaks){
  return breaks.map(b=>({b, q:quote(ctx, lines, +b.qty||1, b.margin==null?null:+b.margin)}));
}
// Nearest quantity above this one that fills the last row (and last sheet, if rigid).
function betterQty(ctx,L,qty){
  const r=calcLine(ctx,L,qty); if(r.error||r.empty) return null;
  const cands=new Set();
  const up=n=>Math.ceil(qty/n)*n;
  if(r.across>1) cands.add(up(r.across));
  if(r.two&&r.perSheet>1) cands.add(up(r.perSheet));
  let best=null;
  cands.forEach(c=>{
    if(c<=qty||c>qty*1.35) return;
    const alt=calcLine(ctx,L,c); if(alt.error||alt.empty) return;
    const unit=r.base/qty, altUnit=alt.base/c;
    if(altUnit < unit*0.995 && (!best||altUnit<best.unit)) best={qty:c,unit:altUnit,save:(1-altUnit/unit)*100};
  });
  return best;
}


return {MODEL_VERSION, R, S, FILMS, OLAMS, ADHS, RIGIDS, CREW, ROLES, PARAMS, DEF,
        MACH, DEFAULT_STOCK, byId, m4, f2, machParts, machName,
        createContext, calcLine, quote, breakQuotes, betterQty};
}));
