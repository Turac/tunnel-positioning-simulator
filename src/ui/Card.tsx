import type { ReactNode, Ref } from 'react'

/** Section group: road views, results, sensor inputs. Each has its own subtle tint. */
export type CardTone = 'road' | 'result' | 'sensor'

interface Props {
  title: string
  /** One plain sentence on what the card shows. */
  subtitle?: string
  tone: CardTone
  /** Shown at the right of the title, e.g. a legend. */
  aside?: ReactNode
  /** The body element; used to measure the drawing width (useWidth). */
  bodyRef?: Ref<HTMLDivElement>
  children: ReactNode
}

/** A titled panel with a tinted header and a coloured left edge for its group. */
export function Card({ title, subtitle, tone, aside, bodyRef, children }: Props) {
  return (
    <section className={`card card-${tone}`}>
      <header className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
        {aside && <div className="legend">{aside}</div>}
      </header>
      <div className="card-body" ref={bodyRef}>
        {children}
      </div>
    </section>
  )
}
