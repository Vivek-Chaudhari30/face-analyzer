export interface NavItem {
  label: string;
  to: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", to: "/" },
  { label: "Our Clinic", to: "/clinic" },
  { label: "3D Profile Studio", to: "/studio" },
  { label: "For Clinics", to: "/for-clinics" },
];

export const BOOK_PATH = "/book";
