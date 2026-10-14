import Image from "next/image";

// Real screenshots of the app (demo business), captured at 2x.
// Source captures: marketing-drafts/landing-review-2026-10-14/app

export function BrowserShot({
  src,
  alt,
  width,
  height,
  priority = false,
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <figure
      className="m-0 overflow-hidden rounded-2xl"
      style={{
        background: "#1B2436",
        boxShadow: "0 40px 90px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      {/* Browser chrome — LTR like a real browser */}
      <div dir="ltr" className="flex items-center gap-3 px-3.5 h-9" aria-hidden="true">
        <div className="flex gap-1.5 shrink-0">
          <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
          <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
          <span className="block w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
        </div>
        <div
          className="flex-1 max-w-[320px] mx-auto h-6 rounded-md flex items-center justify-center gap-1.5 text-[11px]"
          style={{ background: "#0F1626", color: "#94A3B8" }}
        >
          <Image src="/petra-logo.png" alt="" width={14} height={14} className="rounded-[3px] bg-white" />
          app.petra-app.com
        </div>
        <div className="w-[42px] shrink-0" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className="block w-full h-auto"
      />
    </figure>
  );
}

export function PhoneShot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return (
    <figure
      className="m-0 rounded-[30px] p-[6px]"
      style={{
        background: "#0F172A",
        boxShadow: "0 30px 70px -15px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.12)",
      }}
    >
      <div className="relative overflow-hidden rounded-[24px] bg-white">
        <span
          aria-hidden="true"
          className="absolute top-1.5 left-1/2 -translate-x-1/2 z-10 w-14 h-4 rounded-full bg-black"
        />
        <div className="h-5 bg-white" aria-hidden="true" />
        <Image src={src} alt={alt} width={width} height={height} sizes="180px" className="block w-full h-auto" />
      </div>
    </figure>
  );
}
