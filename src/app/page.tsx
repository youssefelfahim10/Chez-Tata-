import { redirect } from "next/navigation";

// La redirection réelle est faite par src/proxy.ts ; ceci n'est qu'un filet.
export default function Page() {
  redirect("/aujourdhui");
}
