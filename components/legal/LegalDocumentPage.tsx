import type { ReactNode } from "react";
import legalDocuments from "@/content/legal-documents.json";

export const LEGAL_SLUGS = [
  "privacy-policy",
  "terms-and-conditions",
  "cancellation-refund-policy",
  "patient-service-disclaimer-consent",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

type LegalBlock = {
  text: string;
  style: string;
  list: boolean;
  bold: boolean;
  italic: boolean;
};

type PreparedBlock = LegalBlock & {
  sourceIndex: number;
  headingLevel: 2 | 3 | null;
  id?: string;
};

export function isLegalSlug(value: string): value is LegalSlug {
  return LEGAL_SLUGS.includes(value as LegalSlug);
}

export function getLegalDocument(slug: LegalSlug) {
  return legalDocuments[slug];
}

function isDocumentTitle(block: LegalBlock, index: number) {
  if (index > 1) return false;
  const title = block.text.replace(/\s+/g, " ").trim().toUpperCase();
  return title === "AYURSARGA"
    || title.includes("PRIVACY POLICY")
    || title.includes("CUSTOMER TERMS & CONDITIONS")
    || title.includes("CANCELLATION & REFUND POLICY")
    || title.includes("PATIENT / SERVICE DISCLAIMER & CONSENT");
}

function getHeadingLevel(block: LegalBlock): 2 | 3 | null {
  if (/Heading2/i.test(block.style)) return 2;
  if (/Heading3/i.test(block.style)) return 3;
  const firstLine = block.text.split("\n", 1)[0].trim();
  const numberedSubsection = /^\d+[A-Z]?\.\d+\s+/.test(firstLine);
  const upperSection = /^\d+[A-Z]?(?:\.\d+)*\.?\s+/.test(firstLine)
    && firstLine === firstLine.toUpperCase();
  if (block.bold && upperSection && firstLine.length <= 150) return 2;
  if (block.bold && numberedSubsection && firstLine.length <= 150) return 3;
  if (block.bold && firstLine.length <= 90 && !/(EFFECTIVE DATE|LAST UPDATED)/i.test(firstLine)) return 3;
  return null;
}

function prepareBlocks(blocks: LegalBlock[]) {
  return blocks.flatMap<PreparedBlock>((block, sourceIndex) => {
    if (isDocumentTitle(block, sourceIndex)) return [];
    const headingLevel = getHeadingLevel(block);
    return [{
      ...block,
      sourceIndex,
      headingLevel,
      id: headingLevel ? `legal-section-${sourceIndex}` : undefined,
    }];
  });
}

function renderText(block: PreparedBlock) {
  const className = [block.bold ? "legal-document-bold" : "", block.italic ? "legal-document-italic" : ""].filter(Boolean).join(" ");
  return <span className={className || undefined}>{block.text}</span>;
}

function renderHeadingText(text: string) {
  const match = text.match(/^(\d+[A-Z]?(?:\.\d+)*\.?)\s+(.+)$/);
  if (!match) return text;
  return <><span className="legal-heading-number">{match[1]}</span><span>{match[2]}</span></>;
}

function hasHeadingNumber(text: string) {
  return /^(\d+[A-Z]?(?:\.\d+)*\.?)\s+/.test(text);
}

function isEmergencyNotice(block: PreparedBlock) {
  return block.bold && block.text.length > 100 && block.text === block.text.toUpperCase();
}

function renderNumberedClause(block: PreparedBlock) {
  const match = block.text.match(/^(\d+\.?)(?:\s*)(.+)$/s);
  if (!match) return null;
  const className = [block.bold ? "legal-document-bold" : "", block.italic ? "legal-document-italic" : ""].filter(Boolean).join(" ");
  return <p className="legal-numbered-clause" key={block.sourceIndex}>
    <span className="legal-clause-number">{match[1]}</span>
    <span className={className || undefined}>{match[2]}</span>
  </p>;
}

function renderBlocks(blocks: PreparedBlock[]) {
  const rendered: ReactNode[] = [];
  let numberedClauseActive = false;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.list) {
      const list: PreparedBlock[] = [];
      while (index < blocks.length && blocks[index].list) {
        list.push(blocks[index]);
        index += 1;
      }
      index -= 1;
      rendered.push(<ul className={`legal-document-list${numberedClauseActive ? " legal-numbered-clause-list" : ""}`} key={`list-${list[0].sourceIndex}`}>
        {list.map((item) => <li key={item.sourceIndex}>{renderText(item)}</li>)}
      </ul>);
      continue;
    }
    if (block.headingLevel === 2) {
      numberedClauseActive = false;
      rendered.push(<h2 className={hasHeadingNumber(block.text) ? "legal-heading-numbered" : undefined} id={block.id} key={block.sourceIndex}>{renderHeadingText(block.text)}</h2>);
      continue;
    }
    if (block.headingLevel === 3) {
      numberedClauseActive = false;
      rendered.push(<h3 className={hasHeadingNumber(block.text) ? "legal-heading-numbered" : undefined} id={block.id} key={block.sourceIndex}>{renderHeadingText(block.text)}</h3>);
      continue;
    }
    const numberedClause = renderNumberedClause(block);
    if (numberedClause) {
      numberedClauseActive = true;
      rendered.push(numberedClause);
      continue;
    }
    const metadata = /(EFFECTIVE DATE|LAST UPDATED)/i.test(block.text) && block.text.length < 100;
    const className = isEmergencyNotice(block)
      ? "legal-document-alert"
      : metadata
        ? "legal-document-metadata"
        : numberedClauseActive
          ? "legal-clause-continuation"
          : undefined;
    rendered.push(<p className={className} key={block.sourceIndex}>{renderText(block)}</p>);
  }
  return rendered;
}

export function LegalDocumentPage({ slug }: { slug: LegalSlug }) {
  const document = getLegalDocument(slug);
  const blocks = prepareBlocks(document.blocks);
  const sections = blocks.filter((block) => block.headingLevel === 2);
  const firstSectionIndex = blocks.findIndex((block) => block.headingLevel === 2);
  const introduction = firstSectionIndex < 0 ? blocks : blocks.slice(0, firstSectionIndex);
  const sectionGroups = sections.map((section, index) => {
    const start = blocks.indexOf(section);
    const nextSection = sections[index + 1];
    const end = nextSection ? blocks.indexOf(nextSection) : blocks.length;
    return blocks.slice(start, end);
  });

  return <main className="legal-page">
    <header id="legal-page-top" className="legal-hero">
      <div className="legal-hero-inner">
        <span className="eyebrow">Ayursarga legal &amp; policies</span>
        <h1>{document.title}</h1>
        <p>Clear information about using Ayursarga and the services available through the platform.</p>
      </div>
    </header>

    <div className="legal-layout">
      <aside className="legal-contents" aria-label={`${document.title} contents`}>
        <span>On this page</span>
        <nav>
          {sections.map((section) => <a href={`#${section.id}`} key={section.sourceIndex}>{section.text}</a>)}
        </nav>
      </aside>
      <article className="legal-document">
        {introduction.length > 0 && <div className="legal-document-introduction">{renderBlocks(introduction)}</div>}
        {sectionGroups.map((section) => <section className="legal-document-section" key={section[0].sourceIndex}>
          {renderBlocks(section)}
        </section>)}
      </article>
    </div>
  </main>;
}
