import type { Metadata } from "next";

export const metadata: Metadata = { title: "Règles de confidentialité" };

const CONTACT = "contact@bebertai.fr";

// Public: linked from Google's consent screen for the Drive access.
export default function PrivacyPage() {
  return (
    <article className="w-full max-w-2xl space-y-4 rounded-xl border bg-background p-6 text-sm leading-6 md:p-8">
      <h1 className="text-2xl font-bold">Règles de confidentialité</h1>
      <p className="text-muted-foreground">Bebert AI, https://bebertai.fr. Dernière mise à jour : 14 novembre 2026.</p>

      <h2 className="pt-2 text-base font-semibold">Données conservées</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Votre compte : nom, adresse e-mail, mot de passe chiffré.</li>
        <li>Les documents que vous importez depuis votre ordinateur, et leur texte découpé en extraits indexés.</li>
        <li>Vos conversations avec l&apos;assistant.</li>
        <li>Les clés d&apos;API des fournisseurs d&apos;IA que vous ajoutez, chiffrées.</li>
      </ul>

      <h2 className="pt-2 text-base font-semibold">Google Drive</h2>
      <p>
        Avec votre accord, Bebert AI lit en lecture seule les fichiers Google Drive que vous choisissez d&apos;importer. Chaque fichier
        est téléchargé pour en extraire le texte, puis supprimé : seuls son nom, ses extraits de texte et leur indexation sont
        conservés. Bebert AI ne modifie, ne supprime et ne partage jamais vos fichiers Drive. Le jeton d&apos;accès est stocké chiffré
        et supprimé lorsque vous déconnectez Google Drive.
      </p>
      <p>
        L&apos;utilisation des informations reçues des API Google respecte les{" "}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          règles relatives aux données utilisateur des services API Google
        </a>
        , y compris les exigences d&apos;utilisation limitée.
      </p>

      <h2 className="pt-2 text-base font-semibold">Utilisation</h2>
      <p>
        Vos données servent uniquement à répondre à vos questions à partir de vos documents. Pour cela, des extraits de vos
        documents et vos questions sont envoyés aux fournisseurs d&apos;IA configurés dans votre compte (par exemple Anthropic,
        Voyage AI). Aucune donnée n&apos;est vendue, utilisée pour de la publicité ou partagée avec d&apos;autres tiers.
      </p>

      <h2 className="pt-2 text-base font-semibold">Hébergement</h2>
      <p>Les données sont hébergées dans l&apos;Union européenne, chez OVHcloud.</p>

      <h2 className="pt-2 text-base font-semibold">Vos droits</h2>
      <p>
        Vous pouvez supprimer vos documents et vos conversations depuis l&apos;application à tout moment. Pour accéder à vos données,
        les rectifier ou supprimer votre compte, écrivez à <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </article>
  );
}
