import { test } from "node:test";
import assert from "node:assert/strict";
import { todaySP, addDaysISO, weekdayOf, nextOccurrence, hash8, brShort } from "../lib/agenda.mjs";

test("todaySP resolve o fuso de São Paulo na virada do dia UTC", () => {
  // 01:00 UTC = 22:00 do dia anterior em SP
  assert.equal(todaySP(new Date("2026-07-11T01:00:00Z")), "2026-07-10");
  assert.equal(todaySP(new Date("2026-07-11T12:00:00Z")), "2026-07-11");
});

test("addDaysISO cruza mês e ano", () => {
  assert.equal(addDaysISO("2026-07-30", 3), "2026-08-02");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-07-11", -1), "2026-07-10");
});

test("nextOccurrence: hoje conta; senão avança até o weekday", () => {
  // 2026-07-11 é sábado (6)
  assert.equal(weekdayOf("2026-07-11"), 6);
  assert.equal(nextOccurrence(6, "2026-07-11"), "2026-07-11"); // sábado hoje
  assert.equal(nextOccurrence(1, "2026-07-11"), "2026-07-13"); // segunda que vem
  assert.equal(nextOccurrence(5, "2026-07-11"), "2026-07-17"); // sexta que vem
});

test("hash8 estável e sensível ao texto", () => {
  assert.equal(hash8("abc"), hash8("abc"));
  assert.notEqual(hash8("abc"), hash8("abd"));
  assert.equal(hash8("qualquer").length, 8);
});

test("brShort", () => {
  assert.equal(brShort("2026-07-15"), "15/07");
});
