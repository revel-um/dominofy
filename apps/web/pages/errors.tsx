import { useRouter } from "next/router";
import { useEffect } from "react";

export default function ErrorsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(
      Object.entries(router.query).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((entry) => [key, entry] as const);
        }
        return value != null ? [[key, String(value)] as const] : [];
      }),
    );

    const target = query.toString()
      ? `/performance?${query.toString()}`
      : "/performance";

    router.replace(target);
  }, [router]);

  return null;
}
