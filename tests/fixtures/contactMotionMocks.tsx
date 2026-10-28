import type { ComponentProps, ReactNode } from "react";

export function FadeUp({ children, className }: { children: ReactNode; className?: string }) { return <div className={className}>{children}</div>; }
export default function Button(props: ComponentProps<"button">) { return <button {...props} />; }
