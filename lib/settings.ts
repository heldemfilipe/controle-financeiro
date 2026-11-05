import { getAppSetting, saveAppSetting } from "./queries";
import { DEFAULT_OWNERS, readStoredOwners, saveOwners, type Owner } from "./owners";
import { getAccConfig, readStoredAccConfig, saveAccConfig, type AccumuladoConfig } from "./utils";

/**
 * Configurações compartilhadas entre aparelhos. O banco é a fonte da verdade e o
 * navegador guarda uma cópia, usada na primeira pintura da tela.
 */
const ACC_CONFIG_SETTING = "acc_config";
const OWNERS_SETTING = "owners";

/**
 * Lê a configuração do banco. Na primeira vez, envia o que estava neste aparelho.
 * Um aparelho sem nada salvo não grava os valores padrão por cima de ninguém.
 */
async function loadSetting<T>(
  key: string,
  readLocal: () => T | null,
  writeLocal: (value: T) => void,
): Promise<T | null> {
  const remote = await getAppSetting<T>(key);
  if (remote != null) {
    writeLocal(remote);
    return remote;
  }
  const local = readLocal();
  if (local != null) await saveAppSetting(key, local).catch(console.error);
  return local;
}

export async function loadAccConfig(): Promise<AccumuladoConfig> {
  const stored = await loadSetting(ACC_CONFIG_SETTING, readStoredAccConfig, saveAccConfig);
  return stored ?? getAccConfig();
}

export async function persistAccConfig(config: AccumuladoConfig): Promise<void> {
  await saveAppSetting(ACC_CONFIG_SETTING, config);
  saveAccConfig(config);
}

export async function loadOwners(): Promise<Owner[]> {
  const stored = await loadSetting(OWNERS_SETTING, readStoredOwners, saveOwners);
  return stored ?? DEFAULT_OWNERS;
}

export async function persistOwners(owners: Owner[]): Promise<void> {
  await saveAppSetting(OWNERS_SETTING, owners);
  saveOwners(owners);
}
