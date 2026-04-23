"use client";

import initSqlJs from "sql.js";
import type { Database, SqlJsStatic } from "sql.js";
import type { RepoScanResult } from "@/lib/home/repo-ingest/shared";

const DB_FILENAME = "repo-ingest.sqlite";
const WASM_PATH = "/sql-wasm.wasm";

export type StoredRepoScanRecord = {
  repoFullName: string;
  storedAt: string;
  result: RepoScanResult;
};

let sqlPromise: Promise<SqlJsStatic> | null = null;

function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => WASM_PATH,
    });
  }

  return sqlPromise;
}

function getOpfsDirectory() {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  return storage.getDirectory?.() ?? null;
}

function supportsOpfs() {
  return typeof window !== "undefined" && Boolean(getOpfsDirectory());
}

async function readDatabaseBytes() {
  if (!supportsOpfs()) {
    const fallback = window.localStorage.getItem(DB_FILENAME);
    if (!fallback) return null;

    try {
      const parsed = JSON.parse(fallback) as number[];
      return parsed.length > 0 ? new Uint8Array(parsed) : null;
    } catch {
      return null;
    }
  }

  const root = await getOpfsDirectory();
  if (!root) return null;

  const handle = await root.getFileHandle(DB_FILENAME, { create: true });
  const file = await handle.getFile();
  const bytes = await file.arrayBuffer();

  return bytes.byteLength > 0 ? new Uint8Array(bytes) : null;
}

async function writeDatabaseBytes(bytes: Uint8Array) {
  if (!supportsOpfs()) {
    window.localStorage.setItem(DB_FILENAME, JSON.stringify(Array.from(bytes)));
    return;
  }

  const root = await getOpfsDirectory();
  if (!root) return;

  const handle = await root.getFileHandle(DB_FILENAME, { create: true });
  const writable = await handle.createWritable();
  const opfsBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  await writable.write(opfsBuffer);
  await writable.close();
}

async function createDatabase() {
  const SQL = await getSql();
  const bytes = await readDatabaseBytes();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS repo_scans (
      repo_full_name TEXT PRIMARY KEY,
      scanned_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);

  return db;
}

async function persistDatabase(db: Database) {
  await writeDatabaseBytes(db.export());
}

function parseStoredRows(db: Database) {
  const result = db.exec(`
    SELECT repo_full_name, scanned_at, payload
    FROM repo_scans
    ORDER BY scanned_at DESC;
  `);

  if (!result[0]) {
    return [] as StoredRepoScanRecord[];
  }

  return result[0].values.map((row) => {
    const repoFullName = String(row[0] ?? "");
    const storedAt = String(row[1] ?? "");
    const payload = JSON.parse(String(row[2] ?? "{}")) as RepoScanResult;
    return {
      repoFullName,
      storedAt,
      result: payload,
    };
  });
}

export async function saveRepoScan(scan: RepoScanResult) {
  const db = await createDatabase();

  try {
    db.run(
      `
      INSERT INTO repo_scans (repo_full_name, scanned_at, payload)
      VALUES (?, ?, ?)
      ON CONFLICT(repo_full_name) DO UPDATE SET
        scanned_at = excluded.scanned_at,
        payload = excluded.payload;
      `,
      [scan.repoFullName, scan.scannedAt, JSON.stringify(scan)],
    );

    await persistDatabase(db);
  } finally {
    db.close();
  }
}

export async function listRepoScans() {
  const db = await createDatabase();

  try {
    return parseStoredRows(db);
  } finally {
    db.close();
  }
}

export async function getStoredRepoScan(repoFullName: string) {
  const db = await createDatabase();

  try {
    const statement = db.prepare(
      `
      SELECT scanned_at, payload
      FROM repo_scans
      WHERE repo_full_name = ?;
      `,
      [repoFullName],
    );

    const hasRow = statement.step();
    if (!hasRow) {
      statement.free();
      return null;
    }

    const record = statement.getAsObject();
    statement.free();

    return {
      repoFullName,
      storedAt: String(record.scanned_at ?? ""),
      result: JSON.parse(String(record.payload ?? "{}")) as RepoScanResult,
    } satisfies StoredRepoScanRecord;
  } finally {
    db.close();
  }
}

export function getStorageModeLabel() {
  return supportsOpfs() ? "OPFS + SQLite WASM" : "SQLite WASM fallback";
}

export const repoScanStore = {
  save: saveRepoScan,
  list: listRepoScans,
  get: getStoredRepoScan,
  label: getStorageModeLabel,
};
