import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col pt-16 md:pt-24">
      <div className="container mx-auto flex-1 px-4 py-16 text-center">
        <p className="mb-3 font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mb-4 text-4xl font-semibold tracking-tighter md:text-6xl">
          That page doesn't exist
        </h1>
        <p className="mx-auto mb-8 max-w-md text-muted-foreground">
          The link may be old or mistyped. Head back to the apps.
        </p>
        <Button asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
      <Footer />
    </div>
  );
}
