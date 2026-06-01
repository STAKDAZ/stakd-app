import AdminLoginClient from "./AdminLoginClient";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    typeof params?.next === "string" && params.next.length
      ? params.next
      : "/admin/dashboard";

  return <AdminLoginClient next={next} />;
}
