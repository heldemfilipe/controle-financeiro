import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, control } = vi.hoisted(() => ({
  db: new Map<string, unknown>(),
  control: { failWrites: false },
}));

vi.mock("./queries", () => ({
  getAppSetting: async (key: string) => db.get(key) ?? null,
  saveAppSetting: async (key: string, value: unknown) => {
    if (control.failWrites) throw new Error("falha ao salvar");
    db.set(key, value);
  },
}));

import { loadAccConfig, loadOwners, persistAccConfig, persistOwners } from "./settings";
import { DEFAULT_OWNERS } from "./owners";

const ACC_KEY = "renda_acc_config";
const OWNERS_KEY = "app_owners";
const pcConfig = { saldoInicial: 500, startMonth: 4, startYear: 2026 };

let browser: Map<string, string>;

beforeEach(() => {
  db.clear();
  control.failWrites = false;
  browser = new Map();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => browser.get(key) ?? null,
    setItem: (key: string, value: string) => browser.set(key, value),
  });
});

describe("configurações compartilhadas", () => {
  it("aparelho sem nada salvo não grava valores padrão no banco", async () => {
    expect((await loadAccConfig()).saldoInicial).toBe(0);
    expect(await loadOwners()).toEqual(DEFAULT_OWNERS);
    expect(db.size).toBe(0);
  });

  it("o primeiro aparelho com valor envia para o banco", async () => {
    browser.set(ACC_KEY, JSON.stringify(pcConfig));
    browser.set(OWNERS_KEY, JSON.stringify([{ id: "ana", name: "Ana", color: "#000" }]));

    expect(await loadAccConfig()).toEqual(pcConfig);
    await loadOwners();

    expect(db.get("acc_config")).toEqual(pcConfig);
    expect(db.get("owners")).toEqual([{ id: "ana", name: "Ana", color: "#000" }]);
  });

  it("o banco vence a cópia de outro aparelho e atualiza essa cópia", async () => {
    db.set("acc_config", pcConfig);
    browser.set(ACC_KEY, JSON.stringify({ saldoInicial: 9, startMonth: 1, startYear: 2020 }));

    expect(await loadAccConfig()).toEqual(pcConfig);
    expect(db.get("acc_config")).toEqual(pcConfig);
    expect(JSON.parse(browser.get(ACC_KEY)!)).toEqual(pcConfig);
  });

  it("salvar grava no banco e no navegador", async () => {
    await persistAccConfig(pcConfig);
    await persistOwners(DEFAULT_OWNERS);

    expect(db.get("acc_config")).toEqual(pcConfig);
    expect(db.get("owners")).toEqual(DEFAULT_OWNERS);
    expect(JSON.parse(browser.get(ACC_KEY)!)).toEqual(pcConfig);
  });

  it("se o banco recusar, avisa e não muda a cópia local", async () => {
    browser.set(ACC_KEY, JSON.stringify(pcConfig));
    control.failWrites = true;

    await expect(persistAccConfig({ ...pcConfig, saldoInicial: 1 })).rejects.toThrow();
    expect(JSON.parse(browser.get(ACC_KEY)!)).toEqual(pcConfig);
  });
});
