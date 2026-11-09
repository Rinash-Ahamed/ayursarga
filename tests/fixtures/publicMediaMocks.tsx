import { forwardRef, useSyncExternalStore, type CSSProperties, type ReactNode, type ReactEventHandler } from "react";

type MotionProps = { children?: ReactNode; className?: string; initial?: unknown; animate?:unknown; exit?:unknown; whileInView?: unknown; viewport?: unknown; transition?: unknown; "aria-hidden"?: boolean };
export const motion = {
  div: forwardRef<HTMLDivElement, MotionProps>(function MediaDiv({ children, className }, ref) { return <div ref={ref} className={className}>{children}</div>; }),
  span: forwardRef<HTMLSpanElement, MotionProps>(function MediaSpan({ children, className, "aria-hidden": hidden }, ref) { return <span ref={ref} className={className} aria-hidden={hidden}>{children}</span>; }),
};
export function AnimatePresence({ children }: {children:ReactNode; initial?:boolean; mode?:string}) { return <>{children}</>; }
const query = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribe = (listener: () => void) => { const media=query(); media.addEventListener("change",listener); return () => media.removeEventListener("change",listener); };
export const useReducedMotion = () => useSyncExternalStore(subscribe, () => query().matches, () => false);

export function Image({ src, alt, width, height, sizes, className, fill, loading, loader, onLoad }: {
  src: string; alt: string; width?: number; height?: number; sizes?: string; className?: string; fill?: boolean; quality?: number; priority?:boolean; unoptimized?:boolean; onLoad?:ReactEventHandler<HTMLImageElement>; loading?: "lazy" | "eager"; loader?: (props: {src:string; width:number}) => string;
}) {
  const style:CSSProperties|undefined=fill?{position:"absolute",inset:0,width:"100%",height:"100%"}:undefined;
  return <img src={loader?loader({src,width:width??1280}):src} srcSet={loader?[640,1280].map(width=>`${loader({src,width})} ${width}w`).join(", "):undefined} alt={alt} width={width} height={height} sizes={sizes} className={className} style={style} loading={loading} onLoad={onLoad} />;
}
export default function Button({ href, children, className }: {href?:string; children:ReactNode; className?:string}) { return <a href={href} className={className}>{children}</a>; }
