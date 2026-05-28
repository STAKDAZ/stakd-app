import AdminLoginClient from "./AdminLoginClient";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next =
    typeof searchParams?.next === "string" && searchParams.next.length
      ? searchParams.next
      : "/admin/dashboard";

  return <AdminLoginClient next={next} />;
}
