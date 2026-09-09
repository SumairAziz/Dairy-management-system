import { InventoryNav } from "./components/InventoryNav";

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full flex flex-col">
      <InventoryNav />
      {children}
    </div>
  );
}
