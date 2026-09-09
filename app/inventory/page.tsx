import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default function InventoryRootPage() {
  redirect(routes.inventoryDashboard);
}
