import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/ComingSoon";
import { features } from "@/lib/features";

/** Provisoire : la suppression du compte (écran 31) fait partie du groupe « États et cas particuliers ». */
export default function SuppressionComptePage() {
  if (!features.deleteAccount) redirect("/profil");
  return <ComingSoon title="Supprimer mon compte" backHref="/profil" backLabel="Retour au profil" />;
}
