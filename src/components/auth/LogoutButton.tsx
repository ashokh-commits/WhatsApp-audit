"use client";

import { logout } from "@/actions/auth";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
