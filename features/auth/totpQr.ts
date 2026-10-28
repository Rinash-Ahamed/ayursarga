import qrcode from "qrcode-generator";

/** Encode locally into numeric SVG geometry; never send setup secrets to a QR service. */
export function buildTotpQr(uri: string) {
  if (typeof uri !== "string" || uri.length > 2048) throw new Error("Invalid authenticator setup.");
  const parsed = new URL(uri);
  if (parsed.protocol !== "otpauth:" || parsed.hostname !== "totp" || !parsed.searchParams.get("secret")) {
    throw new Error("Invalid authenticator setup.");
  }
  const qr = qrcode(0, "M");
  qr.addData(parsed.href, "Byte");
  qr.make();
  const modules = qr.getModuleCount();
  const quiet = 4;
  let path = "";
  for (let row = 0; row < modules; row++) {
    let column = 0;
    while (column < modules) {
      if (!qr.isDark(row, column)) { column++; continue; }
      const start = column;
      while (column < modules && qr.isDark(row, column)) column++;
      const length = column - start;
      path += `M${start + quiet} ${row + quiet}h${length}v1h-${length}z`;
    }
  }
  return { size: modules + quiet * 2, path };
}
