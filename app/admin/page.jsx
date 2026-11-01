import { AdminCharacterImages } from "../components/ui/molecules/CharacterImageContext.jsx";
import { AdminPage } from "../features/admin/AdminPage.jsx";

export default function AdminRoute() {
  return <AdminCharacterImages><AdminPage /></AdminCharacterImages>;
}
