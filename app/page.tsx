import PageShell from "@/components/PageShell";

export default function Page() {
  return <>
    <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("ayursarga-public-opening-seen")==="true")document.documentElement.dataset.ayursargaOpening="seen"}catch{}` }} />
    <PageShell />
  </>;
}
