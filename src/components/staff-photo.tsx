import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Staff photos are tenant-supplied. Local paths go through next/image; remote URLs
 * render as a plain img, because an unconfigured host makes next/image throw.
 */
export function StaffPhoto({ src, alt, sizes, className }: { src: string; alt: string; sizes?: string; className?: string }) {
  if (src.startsWith("/")) {
    return <Image src={src} alt={alt} fill sizes={sizes} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("absolute inset-0 size-full object-cover", className)} />
  );
}
