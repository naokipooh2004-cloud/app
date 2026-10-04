import assert from "node:assert/strict";
import { test } from "node:test";
import { ema, emaSeries, macd, rsi, sma } from "../src/services/indicators.js";

test("sma: 直近 period 本の平均", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([2, 4, 6], 2), 5); // (4+6)/2
});

test("sma: データ不足なら null", () => {
  assert.equal(sma([1, 2], 3), null);
  assert.equal(sma([], 1), null);
});

test("ema: 定数列では同じ値に収束", () => {
  const v = ema([10, 10, 10, 10, 10], 3);
  assert.equal(v, 10);
});

test("emaSeries: 初期値は先頭 period 本の SMA", () => {
  const series = emaSeries([1, 2, 3, 4, 5], 3);
  // 最初の値 = (1+2+3)/3 = 2
  assert.equal(series[0], 2);
  // 長さ = values.length - period + 1
  assert.equal(series.length, 3);
});

test("rsi: 一貫した上昇では 100 に近づく", () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i);
  const r = rsi(up, 14);
  assert.ok(r !== null);
  assert.ok((r as number) > 99, `expected >99, got ${r}`);
});

test("rsi: 一貫した下落では低い値になる", () => {
  const down = Array.from({ length: 30 }, (_, i) => 100 - i);
  const r = rsi(down, 14);
  assert.ok(r !== null);
  assert.ok((r as number) < 1, `expected <1, got ${r}`);
});

test("rsi: データ不足なら null", () => {
  assert.equal(rsi([1, 2, 3], 14), null);
});

test("macd: 十分なデータで数値を返し、histogram = macd - signal", () => {
  const values = Array.from({ length: 60 }, (_, i) =>
    100 + Math.sin(i / 5) * 5,
  );
  const result = macd(values);
  assert.ok(result.macd !== null);
  assert.ok(result.signal !== null);
  assert.ok(result.histogram !== null);
  const diff = (result.macd as number) - (result.signal as number);
  assert.ok(Math.abs(diff - (result.histogram as number)) < 1e-9);
});

test("macd: データ不足なら全て null", () => {
  const result = macd([1, 2, 3]);
  assert.equal(result.macd, null);
  assert.equal(result.signal, null);
  assert.equal(result.histogram, null);
});
