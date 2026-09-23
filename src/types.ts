export type ImageFormat = "jpeg" | "png" | "gif" | "webp" | "avif" | "svg" | "unknown";

export interface Dimensions {
  width: number;
  height: number;
}

/** An image as found on a page or on disk, before any analysis. */
export interface ImageRef {
  /** URL or file path, as it will be shown to the user. */
  src: string;
  /** Width the page asks for, from the width attribute or the sizes attribute. */
  displayWidth?: number;
  /** True when the markup never states a size, which causes layout shift. */
  missingSize?: boolean;
  lazy?: boolean;
}

export interface ImageFacts extends ImageRef {
  bytes: number;
  format: ImageFormat;
  dimensions?: Dimensions;
}

export type FindingCode =
  | "heavy"
  | "oversized"
  | "old-format"
  | "png-photo"
  | "no-dimensions"
  | "not-lazy";

export interface Finding {
  code: FindingCode;
  level: "error" | "warning" | "notice";
  detail: string;
  /** Bytes this finding alone would save, as an estimate. */
  saving: number;
}

export interface ImageReport extends ImageFacts {
  findings: Finding[];
  /** Best estimate of the bytes saved by applying every finding, never double counted. */
  saving: number;
}

export interface Report {
  source: string;
  images: ImageReport[];
  totalBytes: number;
  totalSaving: number;
  failed: { src: string; reason: string }[];
}
