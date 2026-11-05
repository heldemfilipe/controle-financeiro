import { describe, expect, it } from "vitest";
import { createLoadTracker } from "./useLatestLoad";

describe("createLoadTracker", () => {
  it("só a carga mais recente continua válida", () => {
    const startLoad = createLoadTracker();
    const first = startLoad();
    expect(first()).toBe(true);

    const second = startLoad();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
  });

  it("resposta atrasada de um mês antigo é descartada", async () => {
    const startLoad = createLoadTracker();
    let shown = "";

    async function load(month: string, delay: number) {
      const isLatest = startLoad();
      await new Promise(resolve => setTimeout(resolve, delay));
      if (isLatest()) shown = month;
    }

    await Promise.all([load("outubro", 20), load("novembro", 1)]);
    expect(shown).toBe("novembro");
  });
});
