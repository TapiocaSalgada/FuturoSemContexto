import { redirect } from "next/navigation";

export default function HistoryRedirect() {
  redirect("/minha-lista?tab=historico");
}
