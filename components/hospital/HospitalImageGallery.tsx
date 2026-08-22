/* Arbitrary hospital-managed HTTPS sources cannot use next/image host allowlists. */
/* eslint-disable @next/next/no-img-element */

export function HospitalImageGallery({ imageUrls, hospitalName }: { imageUrls: string[]; hospitalName: string }) {
  if (!imageUrls.length) return null;
  return <div className="portal-hospital-gallery" aria-label={`${hospitalName} images`}>
    {imageUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>
      <img src={url} alt={`${hospitalName} image ${index + 1}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    </a>)}
  </div>;
}
