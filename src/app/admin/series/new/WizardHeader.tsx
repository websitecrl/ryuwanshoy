'use client'

import { CheckCircle2 } from 'lucide-react'

type StepState = 'active' | 'done' | 'idle'

function StepDot({ number, label, sublabel, state }: {
  number: number; label: string; sublabel: string; state: StepState
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0"
        style={
          state === 'active'
            ? { background: 'var(--ryu-primary)', color: '#fff', border: '2px solid var(--ryu-primary-deep)' }
            : state === 'done'
            ? { background: '#16A34A', color: '#fff', border: '2px solid #15803D' }
            : { background: 'var(--ryu-surface-3)', color: 'var(--ryu-text-3)', border: '2px solid var(--ryu-border)' }
        }
      >
        {state === 'done' ? <CheckCircle2 size={15} /> : number}
      </div>
      <div>
        <div
          className="font-mono-ryu text-[9.5px] tracking-widest uppercase"
          style={{ color: state === 'active' ? 'var(--ryu-primary-deep)' : state === 'done' ? '#16A34A' : 'var(--ryu-text-3)' }}
        >
          {sublabel}
        </div>
        <div
          className="text-sm font-semibold"
          style={{ color: state !== 'idle' ? 'var(--ryu-text)' : 'var(--ryu-text-2)' }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  { label: 'Series Info',       sublabel: 'Step 1' },
  { label: 'First Chapter',     sublabel: 'Step 2' },
  { label: 'Preview & Publish', sublabel: 'Step 3' },
]

const HEADINGS   = ['Series info', 'First Chapter', 'Preview & Publish']
const EYEBROWS   = ['Create Series · 1/3', 'Create Series · 2/3', 'Create Series · 3/3']
const SUBTITLES  = [
  "Set up the title, genre, and cover. You'll add chapters next.",
  "Upload pages and set the reading order for Chapter 1.",
  "One last look. This is exactly what readers will see when Chapter 1 goes live.",
]

export default function WizardHeader({ step, seriesTitle }: { step: number; seriesTitle: string }) {
  const idx = step - 1

  return (
    <div className="px-8 pt-6 pb-5 max-w-8xl mx-auto w-full">

      {/* Eyebrow */}
      <div className="font-mono-ryu text-[11px] tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--ryu-primary-deep)' }}>
        {EYEBROWS[idx]}
      </div>

        <h1 className="font-heading font-bold mb-5" style={{ fontSize: 34, letterSpacing: -0.8, color: 'var(--ryu-text)', margin: '0 0 20px' }}>
            {HEADINGS[idx]}
         </h1>

      {/* Step tracker */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const stepNum  = i + 1
          const state: StepState = step > stepNum ? 'done' : step === stepNum ? 'active' : 'idle'
          return (
            <div key={s.label} className="flex items-center flex-1 last:flex-none">
              <StepDot number={stepNum} sublabel={s.sublabel} label={s.label} state={state} />
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-4 h-px" style={{ background: step > stepNum ? '#16A34A' : 'var(--ryu-border)', minWidth: 32 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Subtitle */}
      <p className="mt-4 text-sm" style={{ color: 'var(--ryu-text-2)' }}>
        {step === 2 && seriesTitle
          ? `Adding Chapter 1 to "${seriesTitle}". Upload pages and set the reading order.`
          : SUBTITLES[idx]}
      </p>
    </div>
  )
}