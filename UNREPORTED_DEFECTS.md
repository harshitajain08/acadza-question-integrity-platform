# Acadza — Audit of Unreported Questions

**Scope:** the supplied assignment dataset (`questions.json`, `reports.json`, `taxonomy.json`).
**Result:** 43 question records, 44 reports, and 4 question IDs with no associated report.

## Method

1. Loaded all 43 question records and 44 student reports.
2. Matched reports to questions using `report.questionId === question._id`.
3. Extracted each unreported question's stem, answer and solution.
4. Checked the numerical reasoning where it could be independently recalculated.
5. Inspected the raw HTML/MathML for missing or malformed notation.
6. Kept content defects separate from presentation/markup defects and from uncertain observations.

## Summary

| Question ID | QID | Finding | Disposition |
|---|---|---|---|
| `68dea87d387eea3d0d95fbe3` | SecAQ4 | Empty MathML identifier in the unit exponent for α | **Verified notation/rendering defect** |
| `68dea657387eea3d0d95f54a` | SecAQ14 | Suspicious `eqcu` / `eqch` subscripts in solution | **Needs faculty verification** |
| `695ede2a88d7701e561aa9d9` | MHCET_PCB_PYQ_2021_1_BIO_L876 | No clear content defect found | No defect established |
| `68dea6e6387eea3d0d95f6f8` | SecAQ11 | Displacement-method calculation and answer 16 are consistent | No defect established |

---

## Finding 1 — SecAQ4

**Question ID:** `68dea87d387eea3d0d95fbe3`  
**Subject/chapter:** Physics — Electrostatics  
**Verdict:** `defect`  
**Repair category:** `notation`  
**Confidence:** 0.99 that the stored MathML contains an empty identifier; faculty should confirm the intended unit notation before publishing a repair.  
**Route:** `faculty_review`

### Evidence

The question defines the dielectric constant as \(K = \alpha V\), and states that \(\alpha = 1\) volt\(^{-1}\). In the supplied HTML/MathML, the exponent is represented by:

```xml
<msup>
  <mi></mi>
  <mrow><mo>&minus;</mo><mn>1</mn></mrow>
</msup>
```

The base `<mi>` is empty. Consequently, the inverse-unit exponent has no visible unit symbol attached to it. This is a defect in the stored question markup/notation, even though the intended meaning can be inferred from the surrounding text and dimensional consistency.

### Independent verification

Since \(K\) is dimensionless and \(K=\alpha V\), the dimensions of \(\alpha\) must be inverse voltage. Thus the intended unit is \(V^{-1}\) (equivalently, volt\(^{-1}\)).

The solution's charge-conservation equation is also consistent:

\[
\alpha C V^2 + CV = CV_0
\]

With \(\alpha=1\ \mathrm{V}^{-1}\) and \(V_0=30\ \mathrm{V}\):

\[
V^2+V-30=0
\]

\[
(V+6)(V-5)=0
\]

The physically meaningful solution is \(V=5\ \mathrm{V}\), matching stored option A. The numerical answer is not the defect; the missing MathML base in the unit is.

### Recommended repair

Repair the unit markup so the exponent is visibly attached to the unit, for example render the phrase as **\(1\ \mathrm{V}^{-1}\)** or **1 volt\(^{-1}\)**. Do not blindly replace the empty `<mi>` without checking the surrounding HTML, because the word `volt` already appears immediately before the MathML exponent. The corrected rendered phrase should be reviewed in the actual question UI.

**Suggested taxonomy:** `notation` (allowed field: `question`).  
**Automation:** although the taxonomy marks `notation` as auto-capable, this specific edit should remain faculty-reviewed until the rendered output is checked.

---

## Finding 2 — SecAQ14

**Question ID:** `68dea657387eea3d0d95f54a`  
**Subject/chapter:** Physics — Geometrical optics and optical instruments  
**Verdict:** possible `display_issue` / `notation` defect  
**Confidence:** 0.70 that the subscript text is malformed; lower confidence about the intended exact replacement.  
**Route:** `faculty_review`

### Evidence

The solution's final lines contain MathML subscript text that renders as `eqcu` and `eqch`:

- `P_eqcu = 10 D = 2 P_eqcu`
- `P_eqch = 5 D`

These labels appear inconsistent with the surrounding explanation, which refers to equivalent power and the power of each lens. They may be corrupted abbreviations or malformed subscript text.

### Independent verification

For two identical thin converging lenses in contact:

- Object distance \(u=-12.5\ \mathrm{cm}\).
- A real image enlarged four times gives \(v=+50\ \mathrm{cm}\).
- Lens formula gives \(1/f = 1/50 + 1/12.5 = 1/10\ \mathrm{cm}^{-1}\).
- Equivalent focal length is \(10\ \mathrm{cm}\), so equivalent power is \(+10\ \mathrm{D}\).
- Identical lenses in contact have equal powers, so each has \(+5\ \mathrm{D}\).

The stored integer answer `5` is therefore consistent. The possible defect is in the solution's subscript labels, not in the numerical answer.

### Recommended action

Ask faculty/content operations to inspect the rendered MathML and confirm the intended notation (likely “equivalent” and “each”). Do not guess a replacement string from `eqcu` / `eqch` without checking the authoring source.

**Suggested taxonomy:** `notation` in `solution`, if confirmed.  
**Automation:** do not auto-apply until the intended labels are confirmed.

---

## Question 3 — Dialysis statements

**Question ID:** `695ede2a88d7701e561aa9d9`  
**Subject/chapter:** Zoology — Excretory Products and their Elimination  
**Verdict:** no defect established  
**Confidence:** 0.92 for consistency of the supplied answer/solution; this is not a formal textbook-source verification.  
**Route:** `no_change`

### Check

The solution identifies statement I as correct: dialysis can serve as a holding/bridging measure while a patient awaits renal transplantation. It identifies statement II as incorrect because dialysis can also be used as long-term supportive treatment for patients who are not transplant candidates.

Option D says statement I is correct and statement II is incorrect, matching the stored answer `D`.

### Disposition

No unreported defect established from the supplied record. Do not create a repair.

---

## Question 4 — Displacement method

**Question ID:** `68dea6e6387eea3d0d95f6f8`  
**Subject/chapter:** Physics — Geometrical optics and optical instruments  
**Verdict:** no defect established  
**Confidence:** 0.99 for the numerical consistency.  
**Route:** `no_change`

### Independent verification

Given screen-object distance \(D=150\ \mathrm{cm}\) and focal length \(f=24\ \mathrm{cm}\), the lens displacement is:

\[
x=\sqrt{D(D-4f)}
=\sqrt{150(150-96)}
=\sqrt{8100}=90\ \mathrm{cm}
\]

The two lens positions give magnifications that are reciprocals. The ratio of the larger image size to the smaller is:

\[
\left(\frac{D+x}{D-x}\right)^2
=\left(\frac{150+90}{150-90}\right)^2
=\left(\frac{240}{60}\right)^2
=16
\]

This matches the stored integer answer `16` and the supplied solution.

### Disposition

No defect established. Do not create a repair.

---

## Bonus conclusion

The strongest defensible unreported finding in this supplied snapshot is the empty MathML identifier in **SecAQ4**. SecAQ14 has a second plausible solution-notation issue that should be checked by a faculty member before it is reported as a confirmed defect.

The other two unreported questions passed the checks described above. This is preferable to claiming that every unreported question must contain an error.

## Limitations

- The audit uses only the supplied dataset snapshot; it does not query Acadza's live question bank.
- No textbook or official answer-key source was supplied for the biology item.
- A malformed MathML token is established from the source markup, but the final correction should be checked in the rendered UI.
- The `error: 1` field was not treated as proof that a question is defective.
