'use client';

import { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';

/* ═══════════════════════════════════════════════════════════════
   DRUG INTERACTION CHECKER — Clinical Decision Support
   Kenya PPB Compliance | Alpha Pharmacy
   ═══════════════════════════════════════════════════════════════ */

type Severity = 'Major' | 'Moderate' | 'Minor' | 'Contraindicated';

interface Interaction {
  drug1: string;
  drug2: string;
  severity: Severity;
  mechanism: string;
  effect: string;
  management: string;
  onset: string;
  documentation: string;
}

interface DrugProfile {
  name: string;
  class: string;
  contraindications: string[];
  renalCaution: boolean;
  hepaticCaution: boolean;
  pregnancy: string;
  lactation: string;
  commonSideEffects: string[];
}

const SEVERITY_COLOR: Record<Severity, string> = {
  Contraindicated: 'bg-red-100 text-red-800 border border-red-300',
  Major: 'bg-rose-100 text-rose-800 border border-rose-200',
  Moderate: 'bg-amber-100 text-amber-800 border border-amber-200',
  Minor: 'bg-blue-100 text-blue-800 border border-blue-200',
};

const SEVERITY_BADGE: Record<Severity, string> = {
  Contraindicated: 'bg-red-600 text-white',
  Major: 'bg-rose-600 text-white',
  Moderate: 'bg-amber-500 text-white',
  Minor: 'bg-blue-500 text-white',
};

const SEVERITY_ICON: Record<Severity, string> = {
  Contraindicated: '🚫',
  Major: '⛔',
  Moderate: '⚠️',
  Minor: 'ℹ️',
};

// Comprehensive Kenya PPB-relevant drug interaction database
const INTERACTION_DB: Interaction[] = [
  // CONTRAINDICATED
  { drug1: 'Warfarin', drug2: 'Aspirin', severity: 'Contraindicated', mechanism: 'Additive anticoagulant effect + GI mucosal damage', effect: 'Severely increased bleeding risk, GI hemorrhage', management: 'Avoid combination. Use paracetamol for analgesia if needed.', onset: 'Rapid (hours)', documentation: 'Well-established' },
  { drug1: 'MAO Inhibitors', drug2: 'Tramadol', severity: 'Contraindicated', mechanism: 'Serotonin syndrome + seizure risk', effect: 'Life-threatening serotonin syndrome, hypertensive crisis', management: 'Absolute contraindication. Do not use together. Wait 14 days after MAOI discontinuation.', onset: 'Rapid', documentation: 'Well-established' },
  { drug1: 'Sildenafil', drug2: 'Nitrates', severity: 'Contraindicated', mechanism: 'Additive vasodilation via cGMP pathway', effect: 'Severe hypotension, cardiovascular collapse', management: 'Absolutely contraindicated. Avoid all nitrates (including GTN) with PDE5 inhibitors.', onset: 'Rapid', documentation: 'Well-established' },
  { drug1: 'Metformin', drug2: 'IV Contrast Media', severity: 'Contraindicated', mechanism: 'Contrast-induced nephropathy → metformin accumulation → lactic acidosis', effect: 'Potentially fatal lactic acidosis', management: 'Hold metformin 48 hrs before and after IV contrast. Resume only after confirming renal function.', onset: 'Delayed (24–48h)', documentation: 'Well-established' },
  { drug1: 'Ciprofloxacin', drug2: 'Tizanidine', severity: 'Contraindicated', mechanism: 'CYP1A2 inhibition → massive tizanidine accumulation', effect: 'Profound hypotension, sedation, respiratory depression', management: 'Absolute contraindication. Use alternative antibiotic.', onset: 'Rapid (2–3h)', documentation: 'Well-established' },
  { drug1: 'Rifampicin', drug2: 'Oral Contraceptives', severity: 'Contraindicated', mechanism: 'CYP3A4 induction → rapid OCP metabolism → contraceptive failure', effect: 'Unintended pregnancy', management: 'Use non-hormonal contraception during and 4 weeks after rifampicin therapy.', onset: '2–3 weeks', documentation: 'Well-established' },
  { drug1: 'Clopidogrel', drug2: 'Omeprazole', severity: 'Major', mechanism: 'CYP2C19 inhibition → reduced clopidogrel active metabolite formation', effect: 'Reduced antiplatelet effect → increased thromboembolic risk', management: 'Use pantoprazole (less CYP2C19 interaction) instead of omeprazole.', onset: 'Days', documentation: 'Good' },
  // MAJOR
  { drug1: 'Warfarin', drug2: 'Fluconazole', severity: 'Major', mechanism: 'CYP2C9 inhibition → warfarin accumulation', effect: 'Significantly elevated INR, major bleeding risk', management: 'Monitor INR closely. Reduce warfarin dose prophylactically by 25–50%. Consider alternative antifungal.', onset: '2–7 days', documentation: 'Well-established' },
  { drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'Major', mechanism: 'P-glycoprotein inhibition + renal clearance reduction', effect: 'Digoxin toxicity (bradycardia, arrhythmias, nausea, visual disturbances)', management: 'Reduce digoxin dose by 50% when adding amiodarone. Monitor digoxin levels.', onset: '1–7 days', documentation: 'Well-established' },
  { drug1: 'ACE Inhibitors', drug2: 'Potassium Supplements', severity: 'Major', mechanism: 'Additive hyperkalemia — ACEi reduce aldosterone → less K+ excretion', effect: 'Life-threatening hyperkalemia (cardiac arrest)', management: 'Avoid routine K+ supplementation with ACEi. Monitor serum potassium weekly.', onset: 'Days to weeks', documentation: 'Well-established' },
  { drug1: 'Methotrexate', drug2: 'NSAIDs', severity: 'Major', mechanism: 'Reduced renal clearance of methotrexate', effect: 'Methotrexate toxicity — bone marrow suppression, mucositis, hepatotoxicity', management: 'Avoid NSAIDs with methotrexate, especially high-dose MTX. Use paracetamol for pain.', onset: 'Days', documentation: 'Well-established' },
  { drug1: 'Lithium', drug2: 'Diuretics', severity: 'Major', mechanism: 'Sodium depletion → renal lithium reabsorption → lithium toxicity', effect: 'Lithium toxicity (tremor, confusion, seizures, cardiac arrhythmias)', management: 'Avoid thiazides. If necessary, monitor lithium levels closely. Ensure adequate sodium intake.', onset: '1–2 weeks', documentation: 'Well-established' },
  { drug1: 'Statins', drug2: 'Clarithromycin', severity: 'Major', mechanism: 'CYP3A4 inhibition → statin accumulation', effect: 'Myopathy, rhabdomyolysis (especially with simvastatin/lovastatin)', management: 'Withhold statin during clarithromycin course, or use pravastatin (not CYP3A4-metabolized).', onset: '3–5 days', documentation: 'Well-established' },
  { drug1: 'Fluconazole', drug2: 'Carbamazepine', severity: 'Major', mechanism: 'CYP3A4 inhibition → carbamazepine toxicity', effect: 'Carbamazepine toxicity (diplopia, ataxia, drowsiness)', management: 'Monitor carbamazepine levels. Reduce dose or use alternative antifungal.', onset: '2–3 days', documentation: 'Good' },
  { drug1: 'Isoniazid', drug2: 'Phenytoin', severity: 'Major', mechanism: 'CYP2C9 inhibition → phenytoin accumulation', effect: 'Phenytoin toxicity (nystagmus, ataxia, diplopia)', management: 'Monitor phenytoin levels. Reduce phenytoin dose as needed.', onset: '1–2 weeks', documentation: 'Well-established' },
  { drug1: 'Gentamicin', drug2: 'Furosemide', severity: 'Major', mechanism: 'Additive ototoxicity and nephrotoxicity', effect: 'Permanent hearing loss, acute kidney injury', management: 'Avoid combination if possible. If unavoidable, monitor hearing, renal function, and gentamicin levels.', onset: 'Days', documentation: 'Well-established' },
  { drug1: 'Azithromycin', drug2: 'Amiodarone', severity: 'Major', mechanism: 'Additive QT prolongation', effect: 'Torsades de pointes, ventricular fibrillation', management: 'Contraindicated in patients with QT prolongation risk factors. ECG monitoring if used.', onset: 'Rapid', documentation: 'Good' },
  // MODERATE
  { drug1: 'Ciprofloxacin', drug2: 'Antacids (Al/Mg)', severity: 'Moderate', mechanism: 'Chelation → reduced ciprofloxacin absorption', effect: 'Reduced antibiotic efficacy (up to 90% absorption reduction)', management: 'Separate administration by at least 2 hours (antacid after ciprofloxacin).', onset: 'Rapid', documentation: 'Well-established' },
  { drug1: 'Metformin', drug2: 'Alcohol', severity: 'Moderate', mechanism: 'Additive inhibition of hepatic gluconeogenesis → lactic acidosis risk', effect: 'Increased risk of lactic acidosis', management: 'Counsel patient to avoid excessive alcohol. Occasional moderate use generally acceptable.', onset: 'Rapid', documentation: 'Good' },
  { drug1: 'ACE Inhibitors', drug2: 'NSAIDs', severity: 'Moderate', mechanism: 'NSAIDs reduce prostaglandin synthesis → reduced renal vasodilation + sodium retention', effect: 'Reduced antihypertensive effect, acute kidney injury (triple whammy with diuretics)', management: 'Avoid chronic NSAID use with ACEi. Monitor BP and renal function. Use paracetamol preferentially.', onset: 'Days', documentation: 'Well-established' },
  { drug1: 'Warfarin', drug2: 'Paracetamol', severity: 'Moderate', mechanism: 'Unknown — possibly reduced warfarin metabolism', effect: 'Elevated INR with regular high-dose paracetamol (>2g/day)', management: 'Monitor INR if paracetamol dose >2g/day. Single/occasional doses generally safe.', onset: '1–2 weeks', documentation: 'Fair' },
  { drug1: 'SSRIs', drug2: 'NSAIDs', severity: 'Moderate', mechanism: 'SSRIs reduce platelet serotonin + NSAIDs inhibit platelet thromboxane', effect: '3–15x increased GI bleeding risk', management: 'Consider PPI co-prescription. Use paracetamol for pain instead of NSAIDs when possible.', onset: 'Days to weeks', documentation: 'Good' },
  { drug1: 'Amoxicillin', drug2: 'Oral Contraceptives', severity: 'Moderate', mechanism: 'Altered gut flora → reduced enterohepatic recycling of estrogens', effect: 'Possible (debated) reduced contraceptive efficacy', management: 'Use barrier contraception during and 7 days after antibiotic course. Counsel patient.', onset: '7 days', documentation: 'Poor (theoretical)' },
  { drug1: 'Tetracycline', drug2: 'Iron Supplements', severity: 'Moderate', mechanism: 'Chelation → reduced tetracycline absorption (up to 80%)', effect: 'Reduced antibiotic efficacy', management: 'Separate by at least 3 hours.', onset: 'Rapid', documentation: 'Well-established' },
  { drug1: 'Metronidazole', drug2: 'Alcohol', severity: 'Moderate', mechanism: 'Disulfiram-like reaction (inhibition of acetaldehyde dehydrogenase)', effect: 'Severe nausea, vomiting, flushing, tachycardia', management: 'Strictly avoid alcohol during and 48 hours after metronidazole therapy. Counsel patient strongly.', onset: 'Rapid (minutes)', documentation: 'Well-established' },
  { drug1: 'Doxycycline', drug2: 'Antacids', severity: 'Moderate', mechanism: 'Chelation with Ca2+/Mg2+/Al3+ → reduced absorption', effect: 'Reduced antibiotic efficacy', management: 'Take doxycycline 2 hours before or 6 hours after antacids/dairy products.', onset: 'Rapid', documentation: 'Well-established' },
  { drug1: 'Beta-blockers', drug2: 'Verapamil', severity: 'Moderate', mechanism: 'Additive AV nodal depression', effect: 'Severe bradycardia, AV block, cardiac arrest', management: 'Avoid IV verapamil with oral beta-blockers. If combined, monitor heart rate/ECG closely.', onset: 'Rapid (IV) or hours (oral)', documentation: 'Well-established' },
  { drug1: 'Tramadol', drug2: 'SSRIs', severity: 'Moderate', mechanism: 'Additive serotonergic activity + seizure lowering', effect: 'Serotonin syndrome, seizures', management: 'Use with caution. Start tramadol at low doses. Monitor for serotonin syndrome signs.', onset: '1–6 hours', documentation: 'Good' },
  { drug1: 'Ibuprofen', drug2: 'Lithium', severity: 'Moderate', mechanism: 'NSAIDs reduce renal prostaglandin synthesis → reduced lithium excretion', effect: 'Elevated lithium levels → toxicity risk', management: 'Monitor lithium levels. Use paracetamol for pain. Avoid NSAIDs chronically.', onset: '3–10 days', documentation: 'Good' },
  { drug1: 'Isoniazid', drug2: 'Alcohol', severity: 'Moderate', mechanism: 'Additive hepatotoxicity + disulfiram-like reaction', effect: 'Severe hepatitis, hepatotoxicity', management: 'Counsel complete alcohol abstinence during TB treatment. Monitor LFTs monthly.', onset: 'Weeks', documentation: 'Good' },
  // MINOR
  { drug1: 'Ciprofloxacin', drug2: 'Caffeine', severity: 'Minor', mechanism: 'CYP1A2 inhibition → reduced caffeine clearance', effect: 'Increased caffeine effects (insomnia, palpitations, anxiety)', management: 'Advise patient to reduce coffee/tea intake during ciprofloxacin therapy.', onset: 'Rapid', documentation: 'Fair' },
  { drug1: 'Antacids', drug2: 'Iron Supplements', severity: 'Minor', mechanism: 'Increased gastric pH → reduced iron absorption', effect: 'Reduced iron absorption', management: 'Separate by at least 2 hours. Take iron on empty stomach.', onset: 'Rapid', documentation: 'Good' },
  { drug1: 'Paracetamol', drug2: 'Alcohol', severity: 'Minor', mechanism: 'CYP2E1 induction → increased toxic NAPQI metabolite', effect: 'Hepatotoxicity risk with heavy chronic alcohol use (not occasional moderate use)', management: 'Avoid high-dose paracetamol in alcoholic patients. Limit dose to 2g/day maximum.', onset: 'Chronic use', documentation: 'Good' },
];

const DRUG_PROFILES: DrugProfile[] = [
  { name: 'Metformin', class: 'Biguanide Antidiabetic', contraindications: ['eGFR < 30', 'Active hepatic disease', 'Lactic acidosis history', 'IV contrast agents'], renalCaution: true, hepaticCaution: true, pregnancy: 'Category B (generally safe, used in GDM)', lactation: 'Low risk — small amounts in breast milk', commonSideEffects: ['Nausea/vomiting', 'Diarrhea', 'Metallic taste', 'Lactic acidosis (rare, fatal)'] },
  { name: 'Amoxicillin', class: 'Penicillin Antibiotic', contraindications: ['Penicillin allergy', 'Cephalosporin allergy (cross-reactivity ~1-2%)'], renalCaution: true, hepaticCaution: false, pregnancy: 'Category B (safe)', lactation: 'Compatible with breastfeeding', commonSideEffects: ['Diarrhea', 'Rash', 'Nausea', 'Anaphylaxis (rare)', 'C. difficile (rare)'] },
  { name: 'Ciprofloxacin', class: 'Fluoroquinolone Antibiotic', contraindications: ['Children <18y (except specific indications)', 'Tendon disorders', 'Myasthenia gravis', 'QT prolongation'], renalCaution: true, hepaticCaution: false, pregnancy: 'Avoid (teratogenic risk, joint cartilage effects)', lactation: 'Avoid — excreted in breast milk', commonSideEffects: ['Nausea', 'Headache', 'Tendinopathy', 'QT prolongation', 'Photosensitivity', 'Seizures (rare)'] },
  { name: 'Metronidazole', class: 'Nitroimidazole Antiprotozoal/Antibiotic', contraindications: ['1st trimester pregnancy (relative)', 'Alcohol use (48hr)', 'Severe hepatic impairment'], renalCaution: false, hepaticCaution: true, pregnancy: 'Avoid 1st trimester. Category B 2nd/3rd trimester.', lactation: 'Avoid breastfeeding during treatment + 24h after last dose', commonSideEffects: ['Metallic taste', 'Nausea', 'Disulfiram-like reaction with alcohol', 'Peripheral neuropathy (prolonged use)', 'Seizures (high doses)'] },
  { name: 'Warfarin', class: 'Vitamin K Antagonist Anticoagulant', contraindications: ['Active bleeding', 'Recent surgery/trauma', 'Severe hepatic disease', 'Pregnancy (teratogenic)'], renalCaution: false, hepaticCaution: true, pregnancy: 'Category X — teratogenic. Use LMWH instead.', lactation: 'Compatible (minimal excretion)', commonSideEffects: ['Bleeding (major risk)', 'Skin necrosis (rare, early)', 'Purple toe syndrome', 'Fetal warfarin syndrome'] },
  { name: 'Lisinopril', class: 'ACE Inhibitor Antihypertensive', contraindications: ['Pregnancy (teratogenic)', 'Bilateral renal artery stenosis', 'Hereditary angioedema', 'Hyperkalemia'], renalCaution: true, hepaticCaution: false, pregnancy: 'Category D (2nd/3rd trimester) — fetal renal damage, oligohydramnios. AVOID.', lactation: 'Avoid — limited data', commonSideEffects: ['Dry cough (10-15%)', 'Hyperkalemia', 'Angioedema (rare, life-threatening)', 'First-dose hypotension', 'Elevated creatinine'] },
  { name: 'Atorvastatin', class: 'HMG-CoA Reductase Inhibitor (Statin)', contraindications: ['Active liver disease', 'Pregnancy', 'Lactation', 'Unexplained elevated transaminases'], renalCaution: false, hepaticCaution: true, pregnancy: 'Category X — teratogenic. Stop immediately.', lactation: 'Contraindicated — excreted in breast milk', commonSideEffects: ['Myalgia', 'CK elevation', 'Rhabdomyolysis (rare)', 'Elevated liver enzymes', 'Headache', 'Diabetes risk (long-term)'] },
  { name: 'Omeprazole', class: 'Proton Pump Inhibitor', contraindications: ['Rilpivirine co-administration', 'Atazanavir co-administration'], renalCaution: false, hepaticCaution: true, pregnancy: 'Category C — use only if benefit outweighs risk', lactation: 'Use with caution — excreted in breast milk', commonSideEffects: ['Headache', 'Nausea', 'Diarrhea', 'C. difficile (long-term)', 'Hypomagnesemia (chronic)', 'Fracture risk (long-term)', 'Reduced clopidogrel efficacy'] },
  { name: 'Diazepam', class: 'Benzodiazepine Anxiolytic/Anticonvulsant', contraindications: ['Respiratory depression', 'Sleep apnea', 'Myasthenia gravis', 'Severe hepatic disease', 'Pregnancy (1st trimester)'], renalCaution: false, hepaticCaution: true, pregnancy: 'Category D — neonatal withdrawal syndrome, floppy infant. Avoid.', lactation: 'Avoid — significant excretion; neonatal sedation', commonSideEffects: ['Sedation', 'Cognitive impairment', 'Dependence/withdrawal', 'Anterograde amnesia', 'Respiratory depression (high doses)'] },
  { name: 'Artemether/Lumefantrine', class: 'Artemisinin Combination Antimalarial', contraindications: ['1st trimester pregnancy (relative)', 'QT prolongation conditions', 'Hypersensitivity'], renalCaution: false, hepaticCaution: false, pregnancy: '2nd/3rd trimester: generally used. 1st trimester: quinine preferred.', lactation: 'Limited data — use with caution', commonSideEffects: ['Headache', 'Dizziness', 'Nausea', 'QT prolongation', 'Palpitations', 'Sleep disturbances'] },
];

const ALL_DRUG_NAMES = Array.from(new Set([
  ...INTERACTION_DB.map(i => i.drug1),
  ...INTERACTION_DB.map(i => i.drug2),
  ...DRUG_PROFILES.map(d => d.name),
])).sort();

const TABS = ['Interaction Checker', 'Drug Profile', 'Quick Reference', 'Allergy Checker'] as const;

const COMMON_ALLERGIES = [
  { allergen: 'Penicillin', crossReact: ['Amoxicillin', 'Ampicillin', 'Cloxacillin', 'Co-amoxiclav', 'Piperacillin', 'Cephalosporins (1–2% cross-react)'] },
  { allergen: 'Sulfonamides', crossReact: ['Sulfamethoxazole/Trimethoprim (Septrin)', 'Furosemide (rare)', 'Thiazide diuretics (rare)', 'Dapsone (caution)'] },
  { allergen: 'NSAIDs/Aspirin', crossReact: ['Ibuprofen', 'Diclofenac', 'Naproxen', 'Indomethacin', 'Ketorolac', 'Celecoxib (caution — sulfa structure)'] },
  { allergen: 'Cephalosporins', crossReact: ['Cefuroxime', 'Cefalexin', 'Ceftriaxone', 'Cefixime', 'Cefepime'] },
  { allergen: 'Tetracyclines', crossReact: ['Doxycycline', 'Tetracycline', 'Minocycline', 'Tigecycline'] },
  { allergen: 'Fluoroquinolones', crossReact: ['Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Norfloxacin'] },
  { allergen: 'Macrolides', crossReact: ['Azithromycin', 'Erythromycin', 'Clarithromycin', 'Roxithromycin'] },
  { allergen: 'Opioids', crossReact: ['Morphine', 'Tramadol', 'Codeine', 'Pethidine', 'Fentanyl'] },
];

export default function DrugInteractionsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Interaction Checker');
  const [drug1, setDrug1] = useState('');
  const [drug2, setDrug2] = useState('');
  const [drug1Input, setDrug1Input] = useState('');
  const [drug2Input, setDrug2Input] = useState('');
  const [checkedInteractions, setCheckedInteractions] = useState<Interaction[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [profileSearch, setProfileSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<DrugProfile | null>(null);
  const [allergySearch, setAllergySearch] = useState('');
  const [multiDrugs, setMultiDrugs] = useState<string[]>([]);
  const [multiInput, setMultiInput] = useState('');

  const drug1Suggestions = useMemo(() =>
    drug1Input.length > 1 ? ALL_DRUG_NAMES.filter(d => d.toLowerCase().includes(drug1Input.toLowerCase()) && d !== drug2).slice(0, 8) : [],
    [drug1Input, drug2]);

  const drug2Suggestions = useMemo(() =>
    drug2Input.length > 1 ? ALL_DRUG_NAMES.filter(d => d.toLowerCase().includes(drug2Input.toLowerCase()) && d !== drug1).slice(0, 8) : [],
    [drug2Input, drug1]);

  const checkInteraction = useCallback(() => {
    if (!drug1 || !drug2) { toast.error('Select both drugs to check'); return; }
    const results = INTERACTION_DB.filter(i =>
      (i.drug1 === drug1 && i.drug2 === drug2) ||
      (i.drug1 === drug2 && i.drug2 === drug1) ||
      (i.drug1 === drug1 && i.drug2.toLowerCase().includes(drug2.toLowerCase())) ||
      (i.drug1 === drug2 && i.drug2.toLowerCase().includes(drug1.toLowerCase()))
    );
    setCheckedInteractions(results);
    setHasChecked(true);
    if (results.length === 0) toast.success('No known interactions found ✅');
    else if (results.some(r => r.severity === 'Contraindicated')) toast.error(`CONTRAINDICATED: ${drug1} + ${drug2} — Do NOT dispense!`);
    else if (results.some(r => r.severity === 'Major')) toast.error(`Major interaction found! Review carefully.`, { duration: 5000 });
    else toast(`${results.length} interaction(s) found — review management.`, { icon: '⚠️' });
  }, [drug1, drug2]);

  const checkMultiDrug = useCallback(() => {
    if (multiDrugs.length < 2) { toast.error('Add at least 2 drugs'); return; }
    const results: Interaction[] = [];
    for (let i = 0; i < multiDrugs.length; i++) {
      for (let j = i + 1; j < multiDrugs.length; j++) {
        const found = INTERACTION_DB.filter(ix =>
          (ix.drug1 === multiDrugs[i] && ix.drug2 === multiDrugs[j]) ||
          (ix.drug1 === multiDrugs[j] && ix.drug2 === multiDrugs[i])
        );
        results.push(...found);
      }
    }
    setCheckedInteractions(results);
    setHasChecked(true);
  }, [multiDrugs]);

  const profileSuggestions = useMemo(() =>
    profileSearch.length > 1 ? DRUG_PROFILES.filter(d => d.name.toLowerCase().includes(profileSearch.toLowerCase())) : [],
    [profileSearch]);

  const filteredAllergies = useMemo(() =>
    allergySearch ? COMMON_ALLERGIES.filter(a =>
      a.allergen.toLowerCase().includes(allergySearch.toLowerCase()) ||
      a.crossReact.some(c => c.toLowerCase().includes(allergySearch.toLowerCase()))
    ) : COMMON_ALLERGIES,
    [allergySearch]);

  const multiSuggestions = useMemo(() =>
    multiInput.length > 1 ? ALL_DRUG_NAMES.filter(d => d.toLowerCase().includes(multiInput.toLowerCase()) && !multiDrugs.includes(d)).slice(0, 6) : [],
    [multiInput, multiDrugs]);

  const sortedInteractions = useMemo(() => {
    const order: Record<Severity, number> = { Contraindicated: 0, Major: 1, Moderate: 2, Minor: 3 };
    return [...checkedInteractions].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [checkedInteractions]);

  return (
    <div className="w-full max-w-full space-y-3.5 px-1 md:px-2 text-gray-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-rose-500 to-red-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Drug Interaction Checker</h1>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Clinical Decision Support • PPB Compliance • Allergy Cross-Check • Kenya Formulary</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">⚠️ Clinical Use — Always Verify</span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">✅ {INTERACTION_DB.length} Interactions Loaded</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Contraindicated Pairs', value: INTERACTION_DB.filter(i => i.severity === 'Contraindicated').length, color: 'red', color2: 'rose', icon: '🚫' },
          { label: 'Major Interactions', value: INTERACTION_DB.filter(i => i.severity === 'Major').length, color: 'rose', color2: 'pink', icon: '⛔' },
          { label: 'Moderate Interactions', value: INTERACTION_DB.filter(i => i.severity === 'Moderate').length, color: 'amber', color2: 'orange', icon: '⚠️' },
          { label: 'Allergy Groups', value: COMMON_ALLERGIES.length, color: 'violet', color2: 'purple', icon: '🧬' },
        ].map((c, i) => (
          <div key={i} className={`bg-gradient-to-br from-${c.color}-50/80 via-${c.color2}-50/40 to-white p-3 rounded-xl border border-${c.color}-200/80 shadow-xs`}>
            <p className={`text-[10px] font-bold text-${c.color}-800 uppercase tracking-wider`}>{c.icon} {c.label}</p>
            <p className={`text-2xl font-black text-${c.color}-950 tracking-tight`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${tab === t ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{t}</button>
        ))}
      </div>

      {/* ═══ INTERACTION CHECKER ═══ */}
      {tab === 'Interaction Checker' && (
        <div className="space-y-3">
          {/* Two-drug checker */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-sm font-bold text-gray-800 mb-3">🔍 Two-Drug Interaction Check</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">Drug 1</label>
                <input
                  value={drug1Input}
                  onChange={e => { setDrug1Input(e.target.value); setDrug1(''); }}
                  placeholder="Type drug name..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                />
                {drug1Suggestions.length > 0 && !drug1 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {drug1Suggestions.map(d => (
                      <button key={d} onClick={() => { setDrug1(d); setDrug1Input(d); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-rose-50 hover:text-rose-700">{d}</button>
                    ))}
                  </div>
                )}
                {drug1 && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Selected: {drug1}</p>}
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 mb-1">Drug 2</label>
                <input
                  value={drug2Input}
                  onChange={e => { setDrug2Input(e.target.value); setDrug2(''); }}
                  placeholder="Type drug name..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                />
                {drug2Suggestions.length > 0 && !drug2 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {drug2Suggestions.map(d => (
                      <button key={d} onClick={() => { setDrug2(d); setDrug2Input(d); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-rose-50 hover:text-rose-700">{d}</button>
                    ))}
                  </div>
                )}
                {drug2 && <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Selected: {drug2}</p>}
              </div>

              <button
                onClick={checkInteraction}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-sm shadow-xs transition-colors"
              >
                🔍 Check Interactions
              </button>
            </div>
          </div>

          {/* Multi-drug checker */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-sm font-bold text-gray-800 mb-3">💊 Multi-Drug Polypharmacy Check</h2>
            <div className="flex gap-2 items-end mb-3 flex-wrap">
              <div className="flex-1 min-w-48 relative">
                <input
                  value={multiInput}
                  onChange={e => setMultiInput(e.target.value)}
                  placeholder="Add a drug to the list..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
                />
                {multiSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                    {multiSuggestions.map(d => (
                      <button key={d} onClick={() => { setMultiDrugs(prev => [...prev, d]); setMultiInput(''); }} className="w-full text-left px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700">+ {d}</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={checkMultiDrug} disabled={multiDrugs.length < 2} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50">Check All Pairs</button>
              <button onClick={() => { setMultiDrugs([]); setMultiInput(''); setCheckedInteractions([]); setHasChecked(false); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-xs">Clear</button>
            </div>
            {multiDrugs.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {multiDrugs.map((d, i) => (
                  <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 rounded-full text-xs font-bold">
                    💊 {d}
                    <button onClick={() => setMultiDrugs(prev => prev.filter((_, j) => j !== i))} className="text-violet-500 hover:text-red-500 font-black text-sm leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {hasChecked && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">Interaction Results ({sortedInteractions.length} found)</h3>
                {sortedInteractions.length === 0 && (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">✅ No known interactions</span>
                )}
              </div>
              {sortedInteractions.length > 0 && (
                <div className="divide-y divide-gray-100">
                  {sortedInteractions.map((ix, i) => (
                    <div key={i} className={`p-4 ${SEVERITY_COLOR[ix.severity]}`}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-gray-900">{ix.drug1}</span>
                          <span className="text-gray-500 font-bold">+</span>
                          <span className="text-sm font-black text-gray-900">{ix.drug2}</span>
                        </div>
                        <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black ${SEVERITY_BADGE[ix.severity]}`}>{SEVERITY_ICON[ix.severity]} {ix.severity}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="font-bold text-gray-700 mb-0.5">⚙️ Mechanism:</p>
                          <p className="text-gray-600">{ix.mechanism}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 mb-0.5">💥 Clinical Effect:</p>
                          <p className="text-gray-600">{ix.effect}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="font-bold text-gray-700 mb-0.5">🏥 Management:</p>
                          <p className="text-gray-800 font-semibold bg-white/60 px-2 py-1.5 rounded-lg border border-gray-200">{ix.management}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 mb-0.5">⏱ Onset:</p>
                          <p className="text-gray-600">{ix.onset}</p>
                        </div>
                        <div>
                          <p className="font-bold text-gray-700 mb-0.5">📚 Documentation:</p>
                          <p className="text-gray-600">{ix.documentation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ DRUG PROFILE ═══ */}
      {tab === 'Drug Profile' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="relative">
              <input
                value={profileSearch}
                onChange={e => { setProfileSearch(e.target.value); setSelectedProfile(null); }}
                placeholder="Search drug profile (e.g. Metformin, Warfarin)..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
              />
              {profileSuggestions.length > 0 && !selectedProfile && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                  {profileSuggestions.map(d => (
                    <button key={d.name} onClick={() => { setSelectedProfile(d); setProfileSearch(d.name); }} className="w-full text-left px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-violet-50 hover:text-violet-700">💊 {d.name} — <span className="text-gray-500 text-xs">{d.class}</span></button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedProfile ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-800 px-4 py-3">
                <h2 className="text-white font-black text-lg">{selectedProfile.name}</h2>
                <p className="text-violet-200 text-xs font-semibold">{selectedProfile.class}</p>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-xl border border-red-200 p-3">
                  <h3 className="text-xs font-black text-red-800 uppercase tracking-wider mb-2">🚫 Contraindications</h3>
                  <ul className="space-y-1">
                    {selectedProfile.contraindications.map((c, i) => (
                      <li key={i} className="text-xs font-semibold text-red-700 flex items-start gap-1.5"><span className="text-red-500 mt-0.5">•</span>{c}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
                    <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider mb-2">⚠️ Special Cautions</h3>
                    <p className="text-xs font-semibold text-amber-700">🫘 Renal: {selectedProfile.renalCaution ? 'Dose adjustment required' : 'No adjustment needed'}</p>
                    <p className="text-xs font-semibold text-amber-700">🫀 Hepatic: {selectedProfile.hepaticCaution ? 'Use with caution / avoid in severe disease' : 'Generally safe'}</p>
                  </div>
                  <div className="bg-pink-50 rounded-xl border border-pink-200 p-3">
                    <h3 className="text-xs font-black text-pink-800 uppercase tracking-wider mb-1.5">🤰 Pregnancy & Lactation</h3>
                    <p className="text-xs font-semibold text-pink-700 mb-1">Pregnancy: {selectedProfile.pregnancy}</p>
                    <p className="text-xs font-semibold text-pink-700">Lactation: {selectedProfile.lactation}</p>
                  </div>
                </div>
                <div className="sm:col-span-2 bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wider mb-2">⚡ Common Side Effects</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProfile.commonSideEffects.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DRUG_PROFILES.map((d, i) => (
                <button key={i} onClick={() => { setSelectedProfile(d); setProfileSearch(d.name); }} className="bg-white text-left p-4 rounded-xl border border-gray-200 shadow-xs hover:border-violet-300 hover:shadow transition-all">
                  <p className="text-sm font-black text-gray-900">💊 {d.name}</p>
                  <p className="text-xs font-semibold text-violet-600 mt-0.5">{d.class}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {d.renalCaution && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold">Renal Caution</span>}
                    {d.hepaticCaution && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">Hepatic Caution</span>}
                    {d.pregnancy.includes('X') || d.pregnancy.includes('AVOID') ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">Preg. Avoid</span> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ QUICK REFERENCE ═══ */}
      {tab === 'Quick Reference' && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-rose-700 via-red-700 to-pink-800 px-4 py-3">
              <h2 className="text-white font-black text-sm">⚡ Full Interaction Database — Quick Reference</h2>
              <p className="text-rose-200 text-xs">{INTERACTION_DB.length} interactions • Sorted by severity</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gradient-to-r from-rose-700 via-red-700 to-pink-800">
                  {['Drug 1', 'Drug 2', 'Severity', 'Effect', 'Management'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[...INTERACTION_DB].sort((a, b) => {
                    const o: Record<Severity, number> = { Contraindicated: 0, Major: 1, Moderate: 2, Minor: 3 };
                    return o[a.severity] - o[b.severity];
                  }).map((ix, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                      <td className="px-3 py-2 text-xs font-bold text-gray-900">{ix.drug1}</td>
                      <td className="px-3 py-2 text-xs font-bold text-gray-900">{ix.drug2}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${SEVERITY_BADGE[ix.severity]}`}>{SEVERITY_ICON[ix.severity]} {ix.severity}</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-600 max-w-[200px]">{ix.effect}</td>
                      <td className="px-3 py-2 text-xs font-semibold text-gray-700 max-w-[250px]">{ix.management}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ALLERGY CHECKER ═══ */}
      {tab === 'Allergy Checker' && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <h2 className="text-sm font-bold text-gray-800 mb-3">🧬 Allergy Cross-Reactivity Reference</h2>
            <input
              value={allergySearch}
              onChange={e => setAllergySearch(e.target.value)}
              placeholder="Search by allergen or drug name..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredAllergies.map((a, i) => (
              <div key={i} className="bg-white rounded-xl border border-red-200 shadow-xs p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-lg">🚨</span>
                  <div>
                    <p className="text-sm font-black text-red-800">Allergy to: {a.allergen}</p>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Cross-reactive drugs to AVOID:</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.crossReact.map((d, j) => (
                    <span key={j} className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${d.includes('(rare)') || d.includes('caution') || d.includes('%') ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 rounded-xl border border-amber-300 p-4">
            <p className="text-xs font-bold text-amber-800">⚠️ Important Disclaimer</p>
            <p className="text-xs text-amber-700 mt-1 font-semibold">This drug interaction database is for reference only and does not replace clinical judgment. Always consult the Kenya National Formulary, drug package inserts, and involve a qualified pharmacist or clinician in complex cases. The PPB requires all dispensing to be supervised by a registered pharmacist. Report adverse drug reactions to PPB via the ADR reporting portal.</p>
          </div>
        </div>
      )}
    </div>
  );
}
