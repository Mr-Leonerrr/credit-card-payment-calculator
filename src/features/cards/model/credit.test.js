import test from "node:test";
import assert from "node:assert/strict";
import {
  adjustAvailableCredit,
  increaseAvailableCredit,
  reduceAvailableCredit,
} from "./credit.js";

test("purchases reduce known available credit without creating a missing value", () => {
  assert.equal(reduceAvailableCredit("500000", "125000"), "375000");
  assert.equal(reduceAvailableCredit("", "125000"), "");
});

test("payments restore available credit up to the card limit", () => {
  assert.equal(increaseAvailableCredit("375000", "100000", "1000000"), "475000");
  assert.equal(increaseAvailableCredit("950000", "100000", "1000000"), "1000000");
  assert.equal(increaseAvailableCredit("", "100000", "1000000"), "");
});

test("credit corrections can reverse purchases and payments safely", () => {
  assert.equal(adjustAvailableCredit("375000", 125000), "500000");
  assert.equal(adjustAvailableCredit("475000", -100000), "375000");
  assert.equal(adjustAvailableCredit("0", -1), "0");
});
