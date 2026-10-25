import { APP_NAME, COMPETITOR_FEES, PLATFORM_FEE_BPS, TRADE_PROVIDER } from "@/lib/config";

const SIZES = [0.1, 0.5, 1, 2, 5, 10];

export default function FeeAuditPage() {
  const ours = PLATFORM_FEE_BPS / 100;
  const middleman = TRADE_PROVIDER === "pumpportal" ? 0.5 : 0;
  const auto = TRADE_PROVIDER !== "pumpportal";
  return (
    <div className="mx-auto max-w-4xl overflow-y-auto p-8">
      <h1 className="text-2xl font-extrabold">Fee audit</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mut">
        Chaque trade passé sur {APP_NAME} paie exactement ce qui est listé ici, inscrit dans la transaction que tu signes toi-même. Pas de frais
        plateforme, pas de spread caché, pas de « routing fee » : tu paies le réseau et pump.fun, rien d&apos;autre. Tu peux vérifier chaque transfert sur Solscan.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-up/30 bg-up/10 p-4">
          <small className="text-[10px] uppercase tracking-wider text-up">Frais {APP_NAME}</small>
          <b className="block text-3xl font-extrabold">{ours}%</b>
          <span className="text-xs text-mut">{ours === 0 ? "aucun transfert vers la plateforme : la transaction ne contient que le swap" : "transfert SOL vers le wallet de la plateforme, dans la même tx"}</span>
        </div>
        <div className="rounded-lg border border-line2 bg-panel p-4">
          <small className="text-[10px] uppercase tracking-wider text-dim">Frais pump.fun</small>
          <b className="block text-3xl font-extrabold">1%</b>
          <span className="text-xs text-mut">prélevé par le programme pump.fun sur toutes les plateformes, y compris Photon et Axiom</span>
        </div>
        <div className="rounded-lg border border-line2 bg-panel p-4">
          <small className="text-[10px] uppercase tracking-wider text-dim">Intermédiaire</small>
          <b className="block text-3xl font-extrabold">{middleman}%</b>
          <span className="text-xs text-mut">
            {auto
              ? "bonding curve et PumpSwap : instructions construites en local avec les frais lus on-chain, aucun intermédiaire. PumpPortal (0,5 %) uniquement en repli."
              : "PumpPortal (local API) forcé par la configuration"}
          </span>
        </div>
      </div>

      <h2 className="mt-8 text-base font-bold">Comparatif frais plateforme (hors réseau et pump.fun)</h2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-dim">
            <th className="border-b border-line py-2">Taille du trade</th>
            <th className="border-b border-line py-2 text-right text-up">{APP_NAME}</th>
            {COMPETITOR_FEES.map((c) => (
              <th key={c.name} className="border-b border-line py-2 text-right">
                {c.name} ({c.bps / 100}%)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SIZES.map((s) => (
            <tr key={s} className="border-b border-line">
              <td className="py-2">{s} SOL</td>
              <td className="py-2 text-right font-semibold text-up">{((s * PLATFORM_FEE_BPS) / 10_000).toFixed(4)}</td>
              {COMPETITOR_FEES.map((c) => (
                <td key={c.name} className="py-2 text-right text-mut">
                  {((s * c.bps) / 10_000).toFixed(4)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-dim">
        Frais concurrents relevés publiquement ({COMPETITOR_FEES.map((c) => `${c.name} : ${c.note}`).join(" ; ")}). Ils changent : signale-nous toute
        erreur. Les frais de priorité et les tips Jito sont choisis par toi (presets Eco/Fast/Turbo) et vont intégralement aux validateurs.
      </p>

      <h2 className="mt-8 text-base font-bold">Ce que contient une transaction d&apos;achat</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-mut">
        <li>Compute budget : limite + prix unitaire (ta priority fee).</li>
        <li>Création idempotente de ton compte token si nécessaire.</li>
        <li>Instruction <code className="rounded bg-panel2 px-1">buy</code> du programme pump.fun (ou swap PumpSwap après migration).</li>
        {ours > 0 && <li>Transfert SOL de {ours}% vers le wallet plateforme.</li>}
        <li>Si MEV protect : transfert du tip vers un compte Jito et envoi via le block engine.</li>
      </ol>
    </div>
  );
}
