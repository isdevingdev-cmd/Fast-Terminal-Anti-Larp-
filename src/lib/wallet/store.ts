"use client";
/**
 * Non-custodial in-browser wallets.
 * - Keypairs are generated locally (@solana/web3.js) or imported from a base58 secret.
 * - Secrets are stored encrypted (AES-GCM) in localStorage; decrypted keys live in memory
 *   only while the vault is unlocked, and are wiped on lock / tab close.
 * - Nothing is ever sent to a server.
 */
import { create } from "zustand";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { decodeBase58, encodeBase58 } from "../base58";
import { RPC_URL } from "../config";
import { decryptSecret, encryptSecret, type EncryptedBlob } from "./crypto";

const STORAGE_KEY = "fast-terminal.vault.v1";

export interface StoredWallet {
  id: string;
  label: string;
  publicKey: string;
  secret: EncryptedBlob;
  createdAt: number;
}

interface Vault {
  wallets: StoredWallet[];
  activeId: string | null;
}

interface WalletState {
  wallets: StoredWallet[];
  activeId: string | null;
  unlocked: boolean;
  /** decrypted keypairs, in memory only */
  keys: Map<string, Keypair>;
  balances: Map<string, number>; // SOL
  hydrated: boolean;

  hydrate: () => void;
  createWallet: (label: string, password: string) => Promise<StoredWallet>;
  importWallet: (label: string, secretBase58: string, password: string) => Promise<StoredWallet>;
  unlock: (password: string) => Promise<void>;
  lock: () => void;
  setActive: (id: string) => void;
  removeWallet: (id: string) => void;
  exportSecret: (id: string) => string | null;
  refreshBalances: () => Promise<void>;
  activeKeypair: () => Keypair | null;
}

function loadVault(): Vault {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { wallets: [], activeId: null };
    const v = JSON.parse(raw) as Vault;
    return { wallets: v.wallets ?? [], activeId: v.activeId ?? null };
  } catch {
    return { wallets: [], activeId: null };
  }
}

function saveVault(v: Vault) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
}

let connection: Connection | null = null;
export function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, { commitment: "processed" });
  return connection;
}

export const useWallet = create<WalletState>()((set, get) => ({
  wallets: [],
  activeId: null,
  unlocked: false,
  keys: new Map(),
  balances: new Map(),
  hydrated: false,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;
    const v = loadVault();
    set({ wallets: v.wallets, activeId: v.activeId, hydrated: true });
  },

  createWallet: async (label, password) => {
    const kp = Keypair.generate();
    const secret = await encryptSecret(kp.secretKey, password);
    const w: StoredWallet = {
      id: crypto.randomUUID(),
      label: label || `Wallet ${get().wallets.length + 1}`,
      publicKey: kp.publicKey.toBase58(),
      secret,
      createdAt: Date.now(),
    };
    const wallets = [...get().wallets, w];
    const keys = new Map(get().keys);
    keys.set(w.id, kp);
    const activeId = get().activeId ?? w.id;
    saveVault({ wallets, activeId });
    set({ wallets, activeId, keys, unlocked: true });
    void get().refreshBalances();
    return w;
  },

  importWallet: async (label, secretBase58, password) => {
    const bytes = decodeBase58(secretBase58.trim());
    if (bytes.length !== 64) throw new Error("Clé privée invalide (64 octets attendus)");
    const kp = Keypair.fromSecretKey(bytes);
    if (get().wallets.some((w) => w.publicKey === kp.publicKey.toBase58())) throw new Error("Wallet déjà importé");
    const secret = await encryptSecret(kp.secretKey, password);
    const w: StoredWallet = {
      id: crypto.randomUUID(),
      label: label || `Import ${get().wallets.length + 1}`,
      publicKey: kp.publicKey.toBase58(),
      secret,
      createdAt: Date.now(),
    };
    const wallets = [...get().wallets, w];
    const keys = new Map(get().keys);
    keys.set(w.id, kp);
    const activeId = get().activeId ?? w.id;
    saveVault({ wallets, activeId });
    set({ wallets, activeId, keys, unlocked: true });
    void get().refreshBalances();
    return w;
  },

  unlock: async (password) => {
    const keys = new Map<string, Keypair>();
    for (const w of get().wallets) {
      const secret = await decryptSecret(w.secret, password); // throws on wrong password
      keys.set(w.id, Keypair.fromSecretKey(secret));
    }
    set({ keys, unlocked: true });
    void get().refreshBalances();
  },

  lock: () => set({ keys: new Map(), unlocked: false }),

  setActive: (id) => {
    saveVault({ wallets: get().wallets, activeId: id });
    set({ activeId: id });
  },

  removeWallet: (id) => {
    const wallets = get().wallets.filter((w) => w.id !== id);
    const keys = new Map(get().keys);
    keys.delete(id);
    const activeId = get().activeId === id ? (wallets[0]?.id ?? null) : get().activeId;
    saveVault({ wallets, activeId });
    set({ wallets, keys, activeId });
  },

  exportSecret: (id) => {
    const kp = get().keys.get(id);
    return kp ? encodeBase58(kp.secretKey) : null;
  },

  refreshBalances: async () => {
    const conn = getConnection();
    const balances = new Map(get().balances);
    await Promise.all(
      get().wallets.map(async (w) => {
        try {
          const lamports = await conn.getBalance(new PublicKey(w.publicKey), "processed");
          balances.set(w.id, lamports / 1e9);
        } catch {
          /* keep previous */
        }
      }),
    );
    set({ balances });
  },

  activeKeypair: () => {
    const id = get().activeId;
    return id ? (get().keys.get(id) ?? null) : null;
  },
}));

let balanceTimer: ReturnType<typeof setInterval> | null = null;
export function startBalancePolling() {
  if (balanceTimer) return;
  balanceTimer = setInterval(() => {
    const s = useWallet.getState();
    if (s.wallets.length) void s.refreshBalances();
  }, 15_000);
}
