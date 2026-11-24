/*
 * Direction brief
 * 1. Product: a shared study notebook — classmates pool lecture notes, AI merges
 *    them and proposes corrections the group accepts or rejects.
 * 2. Emotion: calm confidence ("our notes finally agree").
 * 3. Visual metaphor: several messy notebooks converging into one clean sheet.
 * 4. References: Linear (restraint, density), Vercel (monochrome + one accent),
 *    a highlighter pen on paper (the aquamarine mark).
 * 5. Signature element: the aquamarine highlight that sweeps across an accepted
 *    correction.
 * 6. Hero visual: React mockup of three member notes feeding a merged sheet with
 *    a suggestion card — built from real UI shapes, no images.
 *
 * STATIC page: no DeepSpace providers. Prerendered at build, so no window /
 * Date.now() during render; motion is CSS keyframes only (reduced-motion safe).
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Check, GitMerge, Layers, X } from 'lucide-react'
import { Seo } from '../components/Seo'
import { Logo } from '../components/Logo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          <Link
            to="/home"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </header>

        <main>
          <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 md:pt-16 lg:grid-cols-[1fr_1.15fr]">
            <div className="landing-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                For study groups
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
                Three notebooks.
                <br />
                <span className="landing-mark">One truth.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
                Everyone adds their lecture notes. Zephmerge merges them into one study sheet and flags
                where you disagree, quoting who wrote what. Your group decides what’s right.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/home"
                  className="group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  Start a group
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                <Link
                  to="/home"
                  className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium transition-colors hover:border-ring"
                >
                  Join with a code
                </Link>
              </div>
            </div>

            <HeroMockup />
          </section>

          <section className="border-t border-border bg-card">
            <div className="mx-auto grid max-w-6xl gap-px px-6 py-16 md:grid-cols-[1.3fr_1fr_1fr] md:gap-10">
              <Step
                n="01"
                icon={<GitMerge className="h-5 w-5" aria-hidden />}
                title="Merge"
                body="One clean sheet from everyone’s notes, organised by topic. Nothing unique gets dropped."
                featured
              />
              <Step n="02" icon={<Check className="h-5 w-5" aria-hidden />} title="Review" body="Accept or reject each flagged conflict. Every flag quotes its sources." />
              <Step n="03" icon={<Layers className="h-5 w-5" aria-hidden />} title="Study" body="Flashcards from the merged sheet, with your own spaced repetition." />
            </div>
          </section>
        </main>

        <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-muted-foreground">
          <span>Zephmerge</span>
          <span>Built on DeepSpace</span>
        </footer>
      </div>
    </>
  )
}

function Step({
  n,
  icon,
  title,
  body,
  featured,
}: {
  n: string
  icon: React.ReactNode
  title: string
  body: string
  featured?: boolean
}) {
  return (
    <div className={featured ? 'py-4 md:pr-6' : 'py-4'}>
      <div className="flex items-center gap-3">
        <span
          className={
            featured
              ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground'
              : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground'
          }
        >
          {icon}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
      </div>
      <h2 className={featured ? 'mt-4 text-2xl font-semibold tracking-tight' : 'mt-4 text-lg font-semibold'}>{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

const NOTES = [
  { who: 'Alex', color: 'bg-member-1', lines: ['d/dx sin x = cos x', 'chain rule: f(g(x))·g′(x)', 'product rule…'] },
  { who: 'Sam', color: 'bg-member-2', lines: ['derivative of sin = cos', 'chain rule = f′(g(x))·g′(x)', 'ex: (3x+1)⁵'] },
  { who: 'Priya', color: 'bg-member-3', lines: ['sin → cos, cos → −sin', 'chain: outside × inside', 'limits review'] },
]

/** Three member notes feeding one merged sheet with a suggestion. CSS-only motion. */
function HeroMockup() {
  return (
    <div className="relative" aria-label="Preview: three members’ notes merged into one sheet with a suggested correction" role="img">
      <div className="grid grid-cols-[0.85fr_1.15fr] gap-4">
        <div className="flex flex-col gap-3">
          {NOTES.map((note, i) => (
            <div
              key={note.who}
              className="landing-note rounded-xl border border-border bg-card p-3 shadow-sm"
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ${note.color}`}>
                  {note.who[0]}
                </span>
                <span className="text-xs font-medium">{note.who}</span>
              </div>
              <ul className="mt-2 space-y-1 font-mono text-[10.5px] leading-snug text-muted-foreground">
                {note.lines.map((l) => (
                  <li key={l} className="truncate">{l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="landing-sheet relative rounded-xl border border-border bg-card p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Merged notes</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand-soft-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> 3 editing
            </span>
          </div>
          <p className="mt-4 text-[13px] font-semibold">Derivatives of trig functions</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
            <li>d/dx sin x = cos x, and d/dx cos x = −sin x</li>
            <li>
              Chain rule:{' '}
              <span className="landing-accept rounded px-0.5 font-mono text-foreground">f′(g(x)) · g′(x)</span>
            </li>
            <li>Work from the outside function in.</li>
          </ul>
          <p className="mt-4 text-[13px] font-semibold">Worked example</p>
          <div className="mt-2 space-y-1.5">
            <div className="h-2 w-11/12 rounded bg-muted" />
            <div className="h-2 w-8/12 rounded bg-muted" />
          </div>

          <div className="landing-suggestion absolute -bottom-10 -left-8 w-[78%] rounded-xl border border-border bg-popover p-3 shadow-xl md:-left-14">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-semibold text-danger-ink">Conflict</span>
              <span className="text-[11px] text-muted-foreground">Alex vs. Sam</span>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug">
              Alex wrote <span className="font-mono">f(g(x))·g′(x)</span>. The outer function should be
              differentiated.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="landing-accept-btn inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground">
                <Check className="h-3 w-3" aria-hidden /> Accept
              </span>
              <span className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[11px] text-muted-foreground">
                <X className="h-3 w-3" aria-hidden /> Reject
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
