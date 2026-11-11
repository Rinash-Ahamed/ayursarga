/* Arbitrary hospital-managed HTTPS sources cannot use next/image host allowlists. */
/* eslint-disable @next/next/no-img-element */
import { hospitalImageSrcSet } from "@/features/hospitals/images";

export function HospitalImageGallery({ imageUrls, hospitalName }: { imageUrls: string[]; hospitalName: string }) {
  if (!imageUrls.length) return null;
  return <div className="portal-hospital-gallery" aria-label={`${hospitalName} images`}>
    {imageUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>
      <img src={url} srcSet={hospitalImageSrcSet(url)} sizes="(max-width: 600px) 50vw, 320px" width={1200} height={900} alt={`${hospitalName} image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      {index === 0 && <span className="portal-image-cover-badge">Cover image</span>}
    </a>)}
  </div>;
}
