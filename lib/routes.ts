/** App Router page paths (not API routes). */

export const routes = {

  dashboard: "/animals/dashboard",

  farms: "/animals/farms",

  units: "/animals/units",

  speciesBreeds: "/animals/species-breeds",

  list: "/animals/list",

  animalDetail: (id: number | string) => `/animals/list/${id}`,

  milkProduction: "/animals/milk-production",

  vaccinations: "/animals/vaccinations",

  breeding: "/animals/breeding",

  heatCycles: "/animals/heat-cycles",

  pregnancy: "/animals/pregnancy",

  calving: "/animals/calving",

  inventory: "/inventory",

  inventoryDashboard: "/inventory/dashboard",

  inventoryItems: "/inventory/items",

  inventoryItemDetail: (id: number | string) => `/inventory/items/${id}`,

  inventoryStockIn: "/inventory/stock-in",

  inventoryStockOut: "/inventory/stock-out",

  inventoryAdjustments: "/inventory/adjustments",

  inventoryTransactions: "/inventory/transactions",

  inventoryLowStock: "/inventory/low-stock",

  inventoryExpiring: "/inventory/expiring",

  inventorySuppliers: "/inventory/suppliers",

  groupTreatment: "/animals/vaccinations/group",

  assistant: "/animals/assistant",

  messages: "/messages",

  settings: "/settings",

  settingsUsers: "/settings/users",

  settingsRoles: "/settings/roles",

  forbidden: "/forbidden",

} as const;

