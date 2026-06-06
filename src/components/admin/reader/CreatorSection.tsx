import Link from "next/link";

type Settings = {
    site_title: string | null
    creator_name: string | null
    site_description: string | null
} | null 

type CreatorSectionProps = {
    settings: Settings
}

export default function CreatorSection({ settings }: CreatorSectionProps) {
    const creatorName = settings?.creator_name ?? 'The Creator'
    const description = 
        settings?.site_description ??
        'Original comics and art. Updated regularly. Fee to read.'

    return (
        <section className="mx-auto w-full max-w-6xl px-4">
      <div className="rounded-xl border border-white/10 bg-neutral-900 px-6 py-10 text-center">

        {/* Label */}
        <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">
          About the Creator
        </p>

        {/* Creator name */}
        <h2 className="mb-4 text-2xl font-bold text-white">
          {creatorName}
        </h2>

        {/* Description */}
        <p className="mx-auto mb-8 max-w-xl text-sm leading-relaxed text-neutral-400">
          {description}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/comics"
            className="rounded-md bg-white px-6 py-2 text-sm font-medium text-neutral-950 hover:bg-white/90 transition-colors"
          >
            Read Comics
          </Link>
          <Link
            href="/donate"
            className="rounded-md border border-white/20 px-6 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Support the Creator
          </Link>
        </div>

      </div>
    </section>
    )
}