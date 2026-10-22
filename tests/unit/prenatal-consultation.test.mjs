import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as React from "react";
import { loadTypeScript } from "../helpers/loadTypeScript.mjs";

function wellnessFlow(pathName) {
  let stateIndex = 0;
  const state = [];
  const { default: WellnessGuide } = loadTypeScript("components/WellnessGuide.tsx", {
    react: { ...React, useRef: (current) => ({ current }), useEffect: () => {}, useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    } },
    "next/image": { default: () => null },
    "framer-motion": { motion: { div: "div", button: "button" }, AnimatePresence: React.Fragment, useReducedMotion: () => true },
  });
  function render() {
    stateIndex = 0;
    const nodes = [];
    function visit(node) {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!React.isValidElement(node)) return;
      nodes.push(node);
      visit(node.props.children);
    }
    visit(WellnessGuide({}));
    return nodes;
  }
  render().find((node) => node.type === "button" && node.props.className?.includes("wellness-path-card") && text(node).includes(pathName)).props.onClick();
  return { render, choose: (label) => render().find((node) => node.type === "button" && text(node) === label).props.onClick() };
}

test("the visible wellness-card row loads eagerly while later images remain lazy", () => {
  const source = readFileSync(new URL("../../components/WellnessGuide.tsx", import.meta.url), "utf8");
  assert.match(source, /loading=\{index < 3 \? "eager" : "lazy"\}/);
  assert.match(source, /image: "\/wellness\/postnatal-care\.jpeg"/);
});

function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return React.isValidElement(node) ? text(node.props.children) : "";
}
function consultationFor(preference, pathName = "Prenatal care") {
  const flow = wellnessFlow(pathName);
  flow.choose(preference);
  flow.choose("Continue →");
  const nodes = flow.render();
  return nodes.find((node) => node.props.className === "consultation-options consultation-options-single");
}

for (const [preference, provider] of [["Pregnancy yoga", "Yoga Instructor"], ["Dietary advice", "Dietitian"], ["Doctor consultation", "Doctor"]]) {
  test(`${preference} displays only ${provider} and preserves the existing booking button`, () => {
    const grid = consultationFor(preference);
    const cards = React.Children.toArray(grid.props.children);
    assert.equal(cards.length, 1);
    const content = React.Children.toArray(cards[0].props.children);
    assert.equal(content.find((node) => node.type === "strong").props.children, provider);
    const booking = content.find((node) => node.type === "a");
    assert.equal(booking.props.children, "Book an appointment");
    assert.equal(booking.props.disabled, undefined);
    assert.match(booking.props.href, /^\/app\/bookings\/consultation\?service=prenatal-/);
  });
}

test("Rejuvenation offers two single-select options and the requested heading", () => {
  const flow = wellnessFlow("Rejuvenation");
  assert.ok(flow.render().some((node) => node.type === "h3" && text(node) === "Explore Your Wellness Options"));
  const choices = flow.render().find((node) => node.props.className === "choice-grid");
  assert.deepEqual(React.Children.toArray(choices.props.children).map(text), ["Detox & Panchakarma", "Cosmetologist consultation"]);
  flow.choose("Detox & Panchakarma");
  flow.choose("Cosmetologist consultation");
  const selected = flow.render().filter((node) => node.type === "button" && node.props["aria-pressed"] === true);
  assert.deepEqual(selected.map(text), ["Cosmetologist consultation"]);
});

test("Cosmetologist opens one online provider card instead of location/date fields", () => {
  const grid = consultationFor("Cosmetologist consultation", "Rejuvenation");
  const cards = React.Children.toArray(grid.props.children);
  assert.equal(cards.length, 1);
  assert.match(text(cards[0]), /Cosmetologist/);
  const booking = React.Children.toArray(cards[0].props.children).find((node) => node.type === "a");
  assert.equal(booking.props.href, "/app/bookings/consultation?service=cosmetologist");
  const flow = wellnessFlow("Rejuvenation");
  flow.choose("Cosmetologist consultation");
  flow.choose("Continue →");
  assert.equal(flow.render().some((node) => node.type === "input" || node.type === "select" || node.type.name === "DateInput"), false);
  flow.choose("← Back");
  flow.choose("Detox & Panchakarma");
  flow.choose("Continue →");
  assert.equal(flow.render().some((node) => node.type.name === "DateInput"), true);
  assert.equal(flow.render().some((node) => node.props.className === "consultation-options consultation-options-single"), false);
});

test("Stress management uses its requested heading and allows only one choice", () => {
  const flow = wellnessFlow("Stress management");
  assert.ok(flow.render().some((node) => node.type === "h3" && text(node) === "What kind of wellness experience are you looking for?"));
  flow.choose("Yoga & relaxation therapies");
  flow.choose("Body therapies");
  const selected = flow.render().filter((node) => node.type === "button" && node.props["aria-pressed"] === true);
  assert.deepEqual(selected.map(text), ["Body therapies"]);
});

test("Psychologist opens a single consultation card without location or date fields", () => {
  const grid = consultationFor("Psychologist consultation", "Stress management");
  const cards = React.Children.toArray(grid.props.children);
  assert.equal(cards.length, 1);
  assert.equal(React.Children.toArray(cards[0].props.children).find((node) => node.type === "strong").props.children, "Psychologist");
  assert.equal(React.Children.toArray(cards[0].props.children).find((node) => node.type === "a").props.href, "/app/bookings/consultation?service=psychologist");
  const flow = wellnessFlow("Stress management");
  flow.choose("Psychologist consultation");
  flow.choose("Continue →");
  assert.equal(flow.render().some((node) => node.type === "input" || node.type === "select" || node.type.name === "DateInput"), false);
  flow.choose("← Back");
  flow.choose("Body therapies");
  flow.choose("Continue →");
  assert.equal(flow.render().some((node) => node.type.name === "DateInput"), true);
});

test("Lactation concerns retain multiselect behavior", () => {
  const flow = wellnessFlow("Lactation support");
  flow.choose("Low milk supply");
  flow.choose("Latching difficulty");
  assert.deepEqual(flow.render().filter((node) => node.type === "button" && node.props["aria-pressed"] === true).map(text), ["Low milk supply", "Latching difficulty"]);
});

test("lactation and women's wellness link to real assigned-consultant booking rather than placeholders", () => {
  for (const [path, preference, service, title] of [["Lactation support", "Low milk supply", "lactation", "Lactation Consultant"], ["Women", "PCOD / PCOS", "womens-wellness", "Women's Wellness Consultant"]]) {
    const flow = wellnessFlow(path); flow.choose(preference); flow.choose("Continue →");
    assert.ok(flow.render().some((node) => node.type === "a" && node.props.href === `/app/bookings/consultation?service=${service}`));
    assert.ok(flow.render().some((node) => node.type === "strong" && text(node) === title));
    assert.equal(flow.render().some((node) => text(node).includes("Dr. Shafna") || text(node).includes("Dr. Mizreen")), false);
  }
});

test("in-person wellness paths lead to centre/package booking with their preferred care date", () => {
  const flow = wellnessFlow("Rejuvenation"); flow.choose("Detox & Panchakarma"); flow.choose("Continue →");
  flow.render().find((node) => node.type.name === "DateInput").props.onChange({ target: { value: "2099-10-25" } });
  flow.choose("Prepare my request →");
  const link = flow.render().find((node) => node.type === "a" && text(node).includes("Browse centres and packages"));
  assert.equal(new URL(link.props.href, "https://test.local").searchParams.get("startDate"), "2099-10-25");
  assert.equal(flow.render().some((node) => node.type === "a" && node.props.href === "/contact"), false);
});
