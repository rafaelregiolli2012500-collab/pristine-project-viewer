import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyBackup, buildBackup, snapshotStorage, verifyBackup } from '../backup';
import { getActiveUnit, getUnscopedStorage, installUnitStorageScope } from '../units';

beforeAll(() => {
  localStorage.setItem('active_unit', 'nova_londrina');
  installUnitStorageScope();
});

beforeEach(() => {
  const raw = getUnscopedStorage();
  while (raw.length) {
    const key = raw.key(0);
    if (key) raw.removeItem(key);
  }
  raw.setItem('active_unit', 'nova_londrina');
  for (const prefix of ['', 'unit:nova_londrina:']) {
    raw.setItem(`${prefix}frente_configs`, '[]');
    raw.setItem(`${prefix}equipment_registry`, '[]');
    raw.setItem(`${prefix}maintenance_records`, '[]');
  }
});

describe('backup integral de unidades', () => {
  it('inclui Vale do Paraná e Nova Londrina mesmo com Nova Londrina ativa', () => {
    const raw = getUnscopedStorage();
    raw.setItem('moagem_data', '[10]');
    raw.setItem('unit:nova_londrina:moagem_data', '[20]');
    expect(getActiveUnit().id).toBe('nova_londrina');
    const backup = buildBackup();
    expect(backup.storage.moagem_data).toBe('[10]');
    expect(backup.storage['unit:nova_londrina:moagem_data']).toBe('[20]');
    expect(verifyBackup(JSON.stringify(backup)).ok).toBe(true);
  });

  it('restaura as duas unidades sem duplicar prefixos e remove dados posteriores', () => {
    const raw = getUnscopedStorage();
    raw.setItem('moagem_data', '[10]');
    raw.setItem('unit:nova_londrina:moagem_data', '[20]');
    const saved = JSON.stringify(buildBackup());
    raw.setItem('moagem_data', '[99]');
    localStorage.setItem('moagem_data', '[99]');
    raw.setItem('extra', 'temporary');
    const result = applyBackup(saved, { safetyBackup: false });
    expect(result.issues).toEqual([]);
    expect(raw.getItem('moagem_data')).toBe('[10]');
    expect(localStorage.getItem('moagem_data')).toBe('[20]');
    expect(raw.getItem('unit:nova_londrina:unit:nova_londrina:moagem_data')).toBeNull();
    expect(raw.getItem('extra')).toBeNull();
  });

  it('exclui e preserva autorização e identidade de instalação em todas as unidades', () => {
    const raw = getUnscopedStorage();
    const protectedKeys = ['monit_installation_id', 'monit.campo/CHAVE/session', 'unit:nova_londrina:monit.campo/CHAVE/session', 'unit:nova_londrina:edit_lock'];
    protectedKeys.forEach(key => raw.setItem(key, 'protected-fixture'));
    const snapshot = snapshotStorage();
    protectedKeys.forEach(key => expect(snapshot[key]).toBeUndefined());
    const backup = buildBackup();
    protectedKeys.forEach(key => { backup.storage[key] = 'must-not-restore'; });
    expect(applyBackup(JSON.stringify(backup), { safetyBackup: false }).ok).toBe(true);
    protectedKeys.forEach(key => expect(raw.getItem(key)).toBe('protected-fixture'));
  });

  it('mantém backups antigos limitados à unidade de origem', () => {
    const raw = getUnscopedStorage();
    raw.setItem('moagem_data', '[10]');
    const legacy = { __backup: true, version: 3, meta: { unidadeId: 'nova_londrina' }, storage: { frente_configs: '[]', equipment_registry: '[]', maintenance_records: '[]', moagem_data: '[30]' } };
    expect(applyBackup(JSON.stringify(legacy), { safetyBackup: false }).ok).toBe(true);
    expect(localStorage.getItem('moagem_data')).toBe('[30]');
    expect(raw.getItem('moagem_data')).toBe('[10]');
  });
});