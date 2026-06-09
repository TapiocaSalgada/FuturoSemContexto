import Link from "next/link";
import { Search } from "lucide-react";

export default function EmptyState({
  title,
  body,
  href = "/explorar",
  action = "Explorar catálogo",
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <section className="empty-state">
      <Search aria-hidden size={24} />
      <h2>{title}</h2>
      <p>{body}</p>
      <Link className="primary-action" href={href}>
        {action}
      </Link>
    </section>
  );
}
