import { redirect } from "next/navigation";

// The intake dashboard was merged into /intake-forms — redirect for any existing links
export default function IntakePage() {
  redirect("/intake-forms");
}
