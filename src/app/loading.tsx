import { PetraLoader } from "@/components/ui/PetraLoader";

// App-open splash — shown while any top-level route streams in
export default function RootLoading() {
  return <PetraLoader size="lg" fullScreen />;
}
