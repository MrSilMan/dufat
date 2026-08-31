import { redirect } from "next/navigation";

/**
 * The employee view moved to /equipa, which is where employees now sign in.
 *
 * Kept as a redirect rather than deleted: invite links, bookmarks and the
 * pre-move nav all point here, and a 404 for someone trying to log their day's
 * work is a worse outcome than one extra hop.
 */
export default function MeuRedirect() {
  redirect("/equipa");
}
