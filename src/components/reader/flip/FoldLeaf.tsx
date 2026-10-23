import { PageContent } from './book'
import type { FoldGeometry, FoldSetup } from './fold'
import { isPage, type Slot } from './views'

const overlayStyle = {
  position:      'absolute',
  inset:         0,
  pointerEvents: 'none',
} as const

export default function FoldLeaf({ geometry, setup, front, back, width, height, frontSpine, backSpine }: {
  geometry: FoldGeometry | null
  setup: FoldSetup
  front: Slot
  back: Slot
  width: number
  height: number
  frontSpine: 'left' | 'right' | null
  backSpine: 'left' | 'right' | null
}) {
  return (
    <>
      {front && (
        <div
          style={{
            position:   'absolute',
            top:        0,
            left:       setup.sheetLeft,
            width,
            height,
            overflow:   'hidden',
            background: '#111',
            clipPath:   geometry?.frontClip,
            zIndex:     2,
          }}
        >
          {isPage(front) && <PageContent page={front} width={width} height={height} eager spine={frontSpine} />}
          {geometry && <div style={{ ...overlayStyle, background: geometry.frontShade }} />}
        </div>
      )}
      {geometry && (
        <div
          style={{
            position:        'absolute',
            top:             0,
            left:            0,
            width,
            height,
            overflow:        'hidden',
            background:      back ? '#111' : 'var(--ryu-page-edge)',
            transformOrigin: '0 0',
            transform:       geometry.flapMatrix,
            clipPath:        geometry.flapClip,
            zIndex:          3,
          }}
        >
          {isPage(back) && <PageContent page={back} width={width} height={height} eager spine={backSpine} />}
          <div style={{ ...overlayStyle, background: geometry.flapShade }} />
        </div>
      )}
    </>
  )
}
