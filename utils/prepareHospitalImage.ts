"use client";

import { prepareImageUpload } from "@/utils/prepareImageUpload";

/** Preserve the gallery's existing source limit and upload preparation. */
export function prepareHospitalImage(file: File): Promise<Blob> {
  return prepareImageUpload(file, 15 * 1024 * 1024);
}
