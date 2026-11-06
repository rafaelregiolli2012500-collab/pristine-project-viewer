/**
 * MONIT.CAMPO
 * Autor e criador: Rafael Regiolli de Souza
 *
 * IDENTIDADE DA MÁQUINA — fonte única do Installation ID.
 *
 * Um computador = um Installation ID, compartilhado por todos os usuários do
 * Windows em C:\ProgramData\MONIT.CAMPO\installation-id.
 *
 * Ordem de resolução (idempotente):
 *   1. arquivo compartilhado válido → usa esse ID;
 *   2. senão, ID antigo do perfil (localStorage) → migra preservando-o;
 *   3. senão, gera um UUID novo (mesmo padrão já usado pelo projeto).
 * A criação é atômica (hard link exclusivo): dois processos simultâneos
 * nunca gravam IDs diferentes — o segundo adota o do primeiro.
 * IDs antigos divergentes nunca são apagados: ficam registrados em
 * migration-conflicts.log para resolução.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_FILE = 'installation-id';
const CONFLICT_FILE = 'migration-conflicts.log';

function defaultSharedDir() {
  const base =
    process.platform === 'win32'
      ? process.env.ProgramData || process.env.ALLUSERSPROFILE || 'C:\\ProgramData'
      : '/var/tmp';
  return path.join(base, 'MONIT.CAMPO');
}

function readValid(file) {
  try {
    const value = fs.readFileSync(file, 'utf8').trim().toLowerCase();
    return ID_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Cria o arquivo somente se não existir; devolve true se este processo venceu. */
function createExclusive(file, id) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${id}\n`, { mode: 0o644 });
  try {
    fs.linkSync(tmp, file); // atômico: falha com EEXIST se outro processo criou antes
    return true;
  } catch (err) {
    if (err && err.code === 'EEXIST') return false;
    // Sistemas sem hard link: abertura exclusiva como alternativa
    try {
      const fd = fs.openSync(file, 'wx', 0o644);
      fs.writeSync(fd, `${id}\n`);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      return true;
    } catch (e2) {
      if (e2 && e2.code === 'EEXIST') return false;
      throw e2;
    }
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function logConflict(dir, official, legacy) {
  const file = path.join(dir, CONFLICT_FILE);
  try {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (existing.includes(`legacy=${legacy}`)) return; // registra cada ID uma única vez
    let user = 'desconhecido';
    try {
      user = os.userInfo().username;
    } catch {
      /* ignore */
    }
    fs.appendFileSync(
      file,
      `${new Date().toISOString()} user=${user} official=${official} legacy=${legacy}\n`,
    );
  } catch {
    /* registro é auxiliar; nunca bloqueia a abertura */
  }
}

/**
 * Resolve o Installation ID oficial da máquina.
 * @param {{ legacyId?: string|null, dir?: string, generate?: () => string }} opts
 * @returns {{ id: string, source: 'shared'|'migrated'|'created', conflict: boolean }}
 */
function resolveInstallationId(opts = {}) {
  const dir = opts.dir || defaultSharedDir();
  const file = path.join(dir, ID_FILE);
  const legacy =
    typeof opts.legacyId === 'string' && ID_RE.test(opts.legacyId.trim())
      ? opts.legacyId.trim().toLowerCase()
      : null;

  const finish = (id, source) => {
    const conflict = Boolean(legacy && legacy !== id);
    if (conflict) logConflict(dir, id, legacy);
    return { id, source, conflict };
  };

  const current = readValid(file);
  if (current) return finish(current, 'shared');

  fs.mkdirSync(dir, { recursive: true });

  // Arquivo existe mas está vazio/em gravação por outro processo: aguarda
  for (let i = 0; i < 20 && fs.existsSync(file); i++) {
    const value = readValid(file);
    if (value) return finish(value, 'shared');
    sleep(25);
  }
  if (fs.existsSync(file) && !readValid(file)) {
    // Arquivo corrompido: preserva cópia e recria com segurança
    fs.renameSync(file, `${file}.invalid-${Date.now()}`);
  }

  const candidate = legacy || (opts.generate ? opts.generate() : crypto.randomUUID());
  if (createExclusive(file, candidate)) {
    try {
      fs.chmodSync(file, 0o444); // somente leitura: evita alteração acidental
    } catch {
      /* ignore */
    }
    return finish(candidate, legacy ? 'migrated' : 'created');
  }
  const winner = readValid(file);
  if (!winner) throw new Error('installation-id compartilhado ilegível');
  return finish(winner, 'shared');
}

module.exports = { resolveInstallationId, defaultSharedDir, ID_RE };
