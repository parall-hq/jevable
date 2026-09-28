import assert from "node:assert/strict";
import { test } from "node:test";
import { jqPath, ruleOrQuestion } from "../src/common.ts";

test("a question stands for judge.boolean on the line, at 0.7", () => {
  assert.equal(ruleOrQuestion(['Is it "down"?'], {}), 'judge.boolean(line, "Is it \\"down\\"?") >= 0.7');
});

test("--on, -t and -v shape the rule", () => {
  assert.equal(ruleOrQuestion(["Q?"], { on: [".body"], threshold: "0.8" }), 'judge.boolean(json.body, "Q?") >= 0.8');
  assert.equal(ruleOrQuestion(["Q?"], { on: [".title", ".body"], invert: true }), 'judge.boolean([json.title, json.body], "Q?") < 0.7');
});

test("jq-style paths become CEL over the record", () => {
  assert.deepEqual([".", ".user.login", ".items[0].name", '.["a-b"]'].map(jqPath), ["json", "json.user.login", "json.items[0].name", 'json["a-b"]']);
  assert.throws(() => jqPath("body"), /jq-style path/);
});

test("a rule and a question do not mix", () => {
  assert.equal(ruleOrQuestion([], { rule: "line == 'x'" }), "line == 'x'");
  assert.throws(() => ruleOrQuestion(["Q?"], { rule: "true" }), /not both/);
  assert.throws(() => ruleOrQuestion([], { rule: "true", on: [".body"] }), /go with a question/);
  assert.equal(ruleOrQuestion([], { rule: "line == 'x'", invert: true }), "!(line == 'x')");
  assert.throws(() => ruleOrQuestion([], {}), /missing question/);
  assert.throws(() => ruleOrQuestion(["Q?"], { threshold: "70" }), /between 0 and 1/);
});
