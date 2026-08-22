import { MAX_HOSPITAL_IMAGES } from "@/features/hospitals/images";

export function HospitalImageFields({ defaultValues = [], error }: { defaultValues?: string[]; error?: string | null }) {
  return <fieldset className="portal-image-fields full">
    <legend>Hospital images</legend>
    <p>
      Add up to four images. Upload each image to Google Drive, set its General access to
      <strong> Anyone with the link</strong> as a Viewer, then paste the sharing link below.
      Images are displayed in a consistent 4:3 frame, so landscape photos work best.
    </p>
    <div className="portal-image-field-grid">
      {Array.from({ length: MAX_HOSPITAL_IMAGES }, (_, index) => <label key={index}>Google Drive image {index + 1}
        <input
          name="hospitalImageUrl"
          type="url"
          defaultValue={defaultValues[index] ?? ""}
          maxLength={500}
          placeholder="https://drive.google.com/file/d/.../view"
        />
      </label>)}
    </div>
    {error && <span className="portal-field-error" role="alert">{error}</span>}
  </fieldset>;
}
