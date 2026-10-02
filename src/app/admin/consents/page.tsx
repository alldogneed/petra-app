import { redirect } from "next/navigation";

// The legacy Master Admin panel was merged into the platform panel at /owner.
export default function Page() {
  redirect("/owner/consents");
}
